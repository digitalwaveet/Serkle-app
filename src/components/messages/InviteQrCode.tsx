import { useMemo } from "react";
import qrcode from "qrcode-generator";
/** Generate the QR entirely on this device; invitation tokens never leave the app. */
export default function InviteQrCode({ url }: { url: string }) {
  const data = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(url);
    code.make();
    return code.createDataURL(4, 16);
  }, [url]);
  return (
    <img
      src={data}
      width={200}
      height={200}
      className="mx-auto my-4 rounded-xl"
      alt="Scan this QR code to open the group invitation"
    />
  );
}
