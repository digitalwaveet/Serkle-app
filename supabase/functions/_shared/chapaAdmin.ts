import { createChapaHandlers, PaymentError, type ChapaDependencies } from './chapa.ts';
import { isChapaMode, type ChapaMode } from './chapaConfiguration.ts';
import { chapaCorsHeaders, chapaJson } from './chapaHttp.ts';

export interface ChapaAdminControl {
  isSuperAdmin(actor: string): Promise<boolean>;
  verifyMode(mode: ChapaMode): Promise<void>;
  setMode(actor: string, mode: ChapaMode, expected: ChapaMode | null): Promise<void>;
  auditWithdrawalCheck(actor: string, reference: string): Promise<void>;
  modeOverride: ChapaMode | null;
}

export function createChapaAdminHandler(deps: ChapaDependencies, control: ChapaAdminControl) {
  const availableModes = deps.availableModes ?? [deps.mode];
  const state = (mode: ChapaMode) => ({ activeMode: mode, availableModes });

  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: chapaCorsHeaders });
    if (req.method !== 'POST') return chapaJson({ error: 'Method not allowed' }, 405);

    try {
      const actor = await deps.authenticate(req);
      if (!await control.isSuperAdmin(actor.id)) throw new PaymentError('Super admin access required', 403);
      const body = await req.json().catch(() => null);
      if (body?.action === 'configuration') return chapaJson(state(deps.mode));

      if (body?.action === 'set_mode') {
        if (!isChapaMode(body.mode) || !isChapaMode(body.expectedMode)) throw new PaymentError('Invalid payment mode');
        if (body.expectedMode !== deps.mode) throw new PaymentError('Payment mode changed. Refresh before trying again.', 409);
        if (!availableModes.includes(body.mode)) throw new PaymentError('Configure the matching Chapa secret in Supabase first.', 409);
        if (body.mode !== deps.mode) {
          await control.verifyMode(body.mode);
          await control.setMode(actor.id, body.mode, control.modeOverride);
        }
        return chapaJson(state(body.mode));
      }

      if (body?.action === 'check_withdrawal') {
        if (typeof body.reference !== 'string' || !body.reference.trim() || body.reference.length > 160) {
          throw new PaymentError('A withdrawal reference is required');
        }
        const intent = await deps.store.get(body.reference.trim());
        if (intent?.kind !== 'withdrawal') throw new PaymentError('Withdrawal not found', 404);
        await control.auditWithdrawalCheck(actor.id, intent.tx_ref);
        const result = await createChapaHandlers(deps).checkRecordedPayment(intent);
        return chapaJson({ reference: result.tx_ref, status: result.status, verifiedAt: result.verified_at ?? null });
      }

      throw new PaymentError('Unknown admin payment action');
    } catch (error) {
      return chapaJson({ error: error instanceof PaymentError ? error.message : 'Could not complete the payment administration request.' },
        error instanceof PaymentError ? error.status : 503);
    }
  };
}
