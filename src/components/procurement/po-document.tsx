import { formatDate } from "@/lib/format";

// The official Purchase Order document body. Rendered by the staff PO page and
// the vendor portal so both see the identical order. Wrap it with the print
// isolation style targeting #po-doc.

const MIN_ROWS = 6;

function pkr(paisa: number | null | undefined): string {
  return paisa == null ? "—" : "PKR " + (paisa / 100).toLocaleString("en-PK");
}
function packOf(packSize: string | null, unit: string | null): string {
  return packSize ? `${packSize}${unit ? ` ${unit}` : ""}` : (unit ?? "");
}

export interface PoDocData {
  poNo: string;
  status: string;
  createdAt: Date;
  amount: number | null;
  prNo: string;
  vendor: {
    company: string;
    address: string | null;
    contactNumber: string | null;
    vendorNo: string | null;
    ntn: string | null;
    stn: string | null;
  } | null;
  lines: {
    id: string;
    description: string;
    packSize: string | null;
    quantity: number;
    unit: string | null;
    rate: number | null;
  }[];
}

export function PoDocument({
  po,
  facilityName,
  issuedByName,
}: {
  po: PoDocData;
  facilityName: string | null;
  issuedByName: string;
}) {
  const blanks = Math.max(0, MIN_ROWS - po.lines.length);

  return (
    <div
      id="po-doc"
      className="rounded-md border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none"
    >
      {/* Form header */}
      <div className="flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <div className="text-lg font-bold tracking-tight">BECS Analytics</div>
          <div className="text-xl font-semibold">PURCHASE ORDER</div>
          {facilityName && (
            <div className="text-xs text-neutral-600">{facilityName}</div>
          )}
        </div>
        <div className="text-right text-[11px] leading-5">
          <div>
            PO No: <span className="font-mono font-semibold">{po.poNo}</span>
          </div>
          <div>Date: {formatDate(po.createdAt)}</div>
          <div>Status: {po.status}</div>
          <div>
            Ref PR: <span className="font-mono">{po.prNo}</span>
          </div>
        </div>
      </div>

      {/* Vendor block */}
      <div className="mt-3 text-[12px] leading-5">
        <div className="font-semibold">To:</div>
        <div className="font-medium">{po.vendor?.company ?? "—"}</div>
        {po.vendor?.address && <div>{po.vendor.address}</div>}
        <div className="text-neutral-700">
          {po.vendor?.contactNumber ? `Contact: ${po.vendor.contactNumber}` : ""}
          {po.vendor?.vendorNo ? `   ·   Vendor No: ${po.vendor.vendorNo}` : ""}
        </div>
        {(po.vendor?.ntn || po.vendor?.stn) && (
          <div className="text-neutral-700">
            {po.vendor?.ntn ? `NTN: ${po.vendor.ntn}` : ""}
            {po.vendor?.stn ? `   ·   STN: ${po.vendor.stn}` : ""}
          </div>
        )}
      </div>

      {/* Line items */}
      <table className="mt-4 w-full border-collapse text-[12px]">
        <thead>
          <tr>
            {[
              ["Sr. #", "w-10"],
              ["Description", ""],
              ["Pack size", "w-24"],
              ["Qty", "w-14"],
              ["Unit price", "w-28"],
              ["Amount", "w-28"],
            ].map(([label, w]) => (
              <th
                key={label}
                className={`border border-black px-2 py-1 text-left align-top font-semibold ${w}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {po.lines.map((l, i) => {
            const amount = l.rate == null ? null : l.rate * l.quantity;
            return (
              <tr key={l.id}>
                <td className="border border-black px-2 py-1 text-center align-top">
                  {i + 1}
                </td>
                <td className="border border-black px-2 py-1 align-top">
                  {l.description}
                </td>
                <td className="border border-black px-2 py-1 align-top">
                  {packOf(l.packSize, l.unit)}
                </td>
                <td className="border border-black px-2 py-1 text-center align-top">
                  {l.quantity}
                </td>
                <td className="border border-black px-2 py-1 text-right align-top tabular-nums">
                  {pkr(l.rate)}
                </td>
                <td className="border border-black px-2 py-1 text-right align-top tabular-nums">
                  {pkr(amount)}
                </td>
              </tr>
            );
          })}
          {Array.from({ length: blanks }).map((_, i) => (
            <tr key={`b${i}`}>
              <td className="border border-black px-2 py-3 text-center">
                {po.lines.length + i + 1}
              </td>
              <td className="border border-black px-2 py-3" />
              <td className="border border-black px-2 py-3" />
              <td className="border border-black px-2 py-3" />
              <td className="border border-black px-2 py-3" />
              <td className="border border-black px-2 py-3" />
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="border border-black px-2 py-1" colSpan={5}>
              Total
            </td>
            <td className="border border-black px-2 py-1 text-right tabular-nums">
              {pkr(po.amount)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Signatures */}
      <div className="mt-10 grid grid-cols-2 gap-8 text-[12px]">
        <div>
          <div className="border-t border-black pt-1">
            Issued by: {issuedByName}
          </div>
        </div>
        <div className="text-right">
          <div className="inline-block border-t border-black pt-1">
            For BECS Analytics
          </div>
        </div>
      </div>
    </div>
  );
}
