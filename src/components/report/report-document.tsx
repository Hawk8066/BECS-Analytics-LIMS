import { formatDate } from "@/lib/format";
import {
  letterheadFor,
  REPORT_NOTES,
  DECISION_RULE,
  DOC_CONTROL,
} from "@/lib/report/letterhead";

// The official BECS Test Report deliverable (BECS/FF/708/01). Rendered by the
// staff print page and the client portal so both produce the identical accredited
// document. Wrap it with a print style (the app/portal layouts differ).

export interface ReportDocParam {
  id: string;
  name: string;
  method: string;
  resultValue: string;
  unit: string;
  limit: string;
  conformity: string | null; // "CONFORM" | "NON_CONFORM" | null
}

export interface ReportDocData {
  facilityCode?: string;
  reportNo: string;
  approvedAt: Date;
  testedAt: Date;
  receivedAt: Date;
  labId: string;
  sampleType: string;
  clientSampleRef: string | null;
  quantity: string | null;
  physicalCondition: string | null;
  conformed: boolean;
  standardName: string | null;
  issuedTo: string;
  issuedAddress: string[];
  focalPerson: string | null;
  focalNumber: string | null;
  isThirdParty: boolean;
  parameters: ReportDocParam[];
  verifiedName: string | null;
  approvedName: string | null;
}

// One right-aligned "Label   value" line in the sample-reference block.
function RefLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-end gap-2">
      <span className="text-neutral-500">{label}</span>
      <span className="min-w-[90px] text-left font-medium">{value || "—"}</span>
    </div>
  );
}

export function ReportDocument({ data }: { data: ReportDocData }) {
  const lh = letterheadFor(data.facilityCode);
  const { conformed } = data;

  return (
    <div
      id="report-doc"
      className="bg-white p-8 text-[12px] text-black shadow-sm print:p-0 print:shadow-none"
    >
      {/* Masthead */}
      <div className="flex items-start justify-between">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/becs-br.png"
            alt="BECS Analytics"
            className="h-14 w-auto object-contain"
          />
          <div className="mt-1 text-[11px]">NTN : {lh.ntn}</div>
        </div>
        <div className="pt-1 text-center">
          <div className="text-2xl font-bold tracking-wide">{lh.name}</div>
          {lh.addressLines.map((l, i) => (
            <div key={i} className="text-[11px] text-neutral-600">
              {l}
            </div>
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/accreditation.png"
          alt="PNAC — Pakistan National Accreditation Council · LAB 316 · ISO 17025"
          className="h-auto w-56 shrink-0 object-contain"
        />
      </div>

      <h1 className="mt-4 text-center text-xl font-bold">Test Report</h1>

      {/* Issued-to + sample reference */}
      <div className="mt-4 flex justify-between gap-8">
        <div className="max-w-[55%]">
          <div className="font-semibold">{data.issuedTo}</div>
          {data.issuedAddress.map((l, i) => (
            <div key={i} className="text-neutral-700">
              {l}
            </div>
          ))}
          {data.focalPerson && (
            <div className="mt-3">
              <div className="font-semibold">
                {data.isThirdParty ? "Focal Person" : "Client's Focal Person"}
              </div>
              <div className="text-neutral-700">{data.focalPerson}</div>
              {data.focalNumber && (
                <div className="text-neutral-700">{data.focalNumber}</div>
              )}
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <RefLine label="Report No" value={data.reportNo} />
          <RefLine label="Lab ID" value={data.labId} />
          <RefLine label="Report Date" value={formatDate(data.approvedAt)} />
          <RefLine label="Sample Tested" value={formatDate(data.testedAt)} />
          <RefLine label="Sample Received" value={formatDate(data.receivedAt)} />
          <div className="pt-2 text-right font-semibold">Sample Reference</div>
          <RefLine label="Client's ID" value={data.clientSampleRef ?? ""} />
          <RefLine label="Material" value={data.sampleType} />
          <RefLine label="Quantity" value={data.quantity ?? ""} />
          <RefLine
            label="Physical Condition"
            value={data.physicalCondition ?? ""}
          />
        </div>
      </div>

      {/* Environmental conditions */}
      <div className="mt-4 flex justify-between border-t border-neutral-300 pt-2 text-[11px]">
        <span className="font-medium text-neutral-700">
          Environmental conditions while performing test
        </span>
        <span>
          Temperature : {lh.environmental.temperature}; Humidity :{" "}
          {lh.environmental.humidity}
        </span>
      </div>

      {/* Results */}
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-y border-black bg-neutral-100">
            <th className="px-2 py-1 text-left font-semibold">Sr #</th>
            <th className="px-2 py-1 text-left font-semibold">Parameter</th>
            <th className="px-2 py-1 text-left font-semibold">Test Method</th>
            <th className="px-2 py-1 text-left font-semibold">Test Result</th>
            <th className="px-2 py-1 text-left font-semibold">Unit</th>
            {conformed && (
              <>
                <th className="px-2 py-1 text-left font-semibold">Limit</th>
                <th className="px-2 py-1 text-left font-semibold">Remarks</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {data.parameters.map((sp, i) => (
            <tr key={sp.id} className="border-b border-neutral-300 align-top">
              <td className="px-2 py-1">{i + 1}</td>
              <td className="px-2 py-1">{sp.name}</td>
              <td className="px-2 py-1 text-neutral-700">{sp.method}</td>
              <td className="px-2 py-1">{sp.resultValue}</td>
              <td className="px-2 py-1 text-neutral-700">{sp.unit}</td>
              {conformed && (
                <>
                  <td className="px-2 py-1 text-neutral-700">{sp.limit}</td>
                  <td className="px-2 py-1">
                    {sp.conformity === "CONFORM"
                      ? "PASS"
                      : sp.conformity === "NON_CONFORM"
                        ? "FAIL"
                        : "—"}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-3 text-center text-[11px] font-semibold text-neutral-600">
        — End of Test Results —
      </div>

      {conformed && data.standardName && (
        <p className="text-[11px]">
          <span className="font-semibold">Conformity:</span> assessed against{" "}
          {data.standardName} on the client&apos;s request.
        </p>
      )}

      {/* Notes */}
      <div className="mt-4 text-[10.5px] leading-snug">
        <div className="font-semibold">Notes :</div>
        <ol className="ml-5 list-decimal space-y-0.5">
          {REPORT_NOTES.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ol>
        <p className="mt-1">
          <span className="font-semibold">Decision rule:</span> {DECISION_RULE}
        </p>
      </div>

      {/* Signatures */}
      <div className="mt-10 flex items-end justify-between text-center text-[11px]">
        <div className="w-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sign-om.jpg"
            alt="Operations Manager signature"
            className="mx-auto h-12 w-auto object-contain"
          />
          <div className="border-t border-black pt-1 font-semibold">
            Operations Manager
          </div>
          {data.verifiedName && (
            <div className="text-neutral-600">{data.verifiedName}</div>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/becs-stamp.png"
          alt="BECS Analytics Lahore stamp"
          className="h-24 w-24 object-contain"
        />
        <div className="w-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sign-coo.png"
            alt="Chief Operating Officer signature"
            className="mx-auto h-12 w-auto object-contain"
          />
          <div className="border-t border-black pt-1 font-semibold">
            Chief Operating Officer
          </div>
          {data.approvedName && (
            <div className="text-neutral-600">{data.approvedName}</div>
          )}
        </div>
      </div>

      {/* Controlled-document footer — pinned to the bottom of the page in print. */}
      <div className="mt-8 border-t border-neutral-300 pt-2 text-[10px] text-neutral-500 print:fixed print:inset-x-0 print:bottom-0 print:mt-0">
        {DOC_CONTROL}
      </div>
    </div>
  );
}
