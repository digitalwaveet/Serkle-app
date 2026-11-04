import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const chapaSecretKey = Deno.env.get("CHAPA_SECRET_KEY");
    if (!chapaSecretKey) {
      throw new Error("CHAPA_SECRET_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      throw new Error("Unauthorized: Missing token");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Unauthorized: Invalid token");
    }

    // GET mode: return the list of banks supported by Chapa
    if (req.method === "GET") {
      const banksRes = await fetch("https://api.chapa.co/v1/banks", {
        headers: { Authorization: `Bearer ${chapaSecretKey}` },
      });
      const banksData = await banksRes.json();
      return new Response(
        JSON.stringify({ success: true, banks: banksData.data ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST mode: initiate withdrawal / transfer
    const { amount, accountName, accountNumber, bankCode } = await req.json();

    if (!amount || amount < 10) {
      throw new Error("Minimum withdrawal amount is 10 ETB");
    }
    if (!accountName || !accountNumber || !bankCode) {
      throw new Error("Account name, account number, and bank are required");
    }

    // Check user's wallet balance BEFORE calling Chapa
    const { data: wallet } = await supabase
      .from("coin_wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!wallet || wallet.balance < amount) {
      throw new Error("Insufficient wallet balance");
    }

    // Debit the wallet first (safer: prevents double-withdrawal even if Chapa is slow)
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "request_withdrawal",
      {
        _user_id: user.id,
        _amount: amount,
        _payout_method: "chapa_bank_transfer",
      }
    );

    if (rpcError || !rpcData) {
      throw new Error(rpcError?.message || "Wallet debit failed");
    }

    // Generate a unique reference for this transfer
    const reference = `withdrawal-${user.id.slice(0, 8)}-${Date.now()}`;

    // Initiate Chapa bank transfer
    const transferPayload = {
      account_name: accountName,
      account_number: accountNumber,
      amount: amount.toString(),
      currency: "ETB",
      reference,
      bank_code: bankCode,
    };

    const chapaRes = await fetch("https://api.chapa.co/v1/transfers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chapaSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transferPayload),
    });

    const chapaData = await chapaRes.json();

    if (!chapaRes.ok || chapaData.status !== "success") {
      console.error("Chapa transfer error:", chapaData);
      // NOTE: wallet was already debited. In production you would refund here.
      // For now, log and surface the error — admin can manually refund via dashboard.
      console.error(
        `MANUAL REFUND NEEDED: userId=${user.id}, amount=${amount}, ref=${reference}`
      );
      throw new Error(
        chapaData.message || "Chapa transfer failed — please contact support"
      );
    }

    // Store the Chapa reference on the withdrawal transaction for tracking
    await supabase
      .from("coin_transactions")
      .update({ reference_id: reference })
      .eq("user_id", user.id)
      .eq("type", "withdrawal")
      .is("reference_id", null)
      .order("created_at", { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({
        success: true,
        reference,
        status: "queued",
        message: `Withdrawal of ${amount} ETB is being processed (3-5 business days)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("chapa-transfer error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
