"use client";

import { useActionState, useState } from "react";
import {
  createProductType,
  type ProductTypeFormState,
} from "@/lib/actions/production-qc";
import { NEW_PARAMETER } from "@/lib/parameters/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

export type ParentOption = { id: string; name: string };
export type ParameterOption = {
  id: string;
  name: string;
  matrix: string | null;
  price: number | null;
};

const pkr = (paisa: number) => "PKR " + (paisa / 100).toLocaleString("en-PK");

const SELECT_CLASS =
  "h-9 rounded-md border bg-transparent px-2 text-sm aria-invalid:border-destructive";

function Field({
  name,
  label,
  state,
  ...rest
}: {
  name: string;
  label: string;
  state: ProductTypeFormState;
} & React.ComponentProps<typeof Input>) {
  const invalid = state.field === name;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "product-error" : undefined}
        {...rest}
      />
    </div>
  );
}

/**
 * ADMIN-only creation of a QC product type, and optionally the Parameter it is
 * billed at, in one submit.
 *
 * Product types were previously only creatable through the generic admin table
 * editor, which knows nothing about stages, lineage or billing rates — so a
 * fresh environment showed "No product types configured" with no way forward
 * from this screen.
 */
export function NewProductTypeButton({
  parents,
  parameters,
}: {
  parents: ParentOption[];
  parameters: ParameterOption[];
}) {
  const [open, setOpen] = useState(false);
  const [newParameter, setNewParameter] = useState(false);
  // Close only once the server confirms, by wrapping the action rather than
  // reacting to its result in an effect. Closing in onSubmit — the pattern the
  // inventory Add-item modal uses — would discard the error before it rendered,
  // and closing from an effect is a set-state-in-effect smell.
  const [state, formAction, pending] = useActionState<
    ProductTypeFormState,
    FormData
  >(async (prev, formData) => {
    const result = await createProductType(prev, formData);
    if (result.ok) {
      setOpen(false);
      setNewParameter(false);
    }
    return result;
  }, {});

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        New product type
      </Button>

      {open && (
        <Modal
          title="New product type"
          onClose={() => setOpen(false)}
          className="max-w-2xl"
        >
          <form action={formAction} className="grid gap-4">
            {state.error && (
              <p
                id="product-error"
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {state.error}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                name="name"
                label="Product name"
                state={state}
                placeholder="e.g. Raw Zinc"
                required
              />
              <Field
                name="testParameter"
                label="Test performed"
                state={state}
                placeholder="e.g. Total Zinc"
                required
              />

              <div className="grid gap-1.5">
                <Label htmlFor="stage">Stage</Label>
                <select
                  id="stage"
                  name="stage"
                  defaultValue="RAW"
                  className={SELECT_CLASS}
                  aria-invalid={state.field === "stage" || undefined}
                >
                  <option value="RAW">Raw material</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="FINISHED">Finished product</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="basis">A lot is…</Label>
                <select
                  id="basis"
                  name="basis"
                  defaultValue="VEHICLE"
                  className={SELECT_CLASS}
                  aria-invalid={state.field === "basis" || undefined}
                >
                  <option value="VEHICLE">Each incoming vehicle load</option>
                  <option value="BATCH">Each production batch</option>
                </select>
              </div>

              <Field name="unit" label="Unit" state={state} defaultValue="%" />

              <div className="grid gap-1.5">
                <Label htmlFor="parentTypeId">Made from (traceability)</Label>
                <select
                  id="parentTypeId"
                  name="parentTypeId"
                  defaultValue=""
                  className={SELECT_CLASS}
                >
                  <option value="">— none —</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <Field
                name="specMin"
                label="Spec minimum"
                state={state}
                type="number"
                step="any"
                placeholder="optional"
              />
              <Field
                name="specMax"
                label="Spec maximum"
                state={state}
                type="number"
                step="any"
                placeholder="optional"
              />
            </div>

            {/* Billing rate. Unset, or set to an unpriced parameter, means lots
                of this product are not billable and stay open for a later run. */}
            <fieldset className="grid gap-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">Billed as</legend>
              <select
                name="parameterId"
                defaultValue=""
                onChange={(e) => setNewParameter(e.target.value === NEW_PARAMETER)}
                className={SELECT_CLASS}
              >
                <option value="">— not billable yet —</option>
                <option value={NEW_PARAMETER}>+ Create a new parameter…</option>
                {parameters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.matrix ? ` · ${p.matrix}` : ""}
                    {p.price != null ? ` · ${pkr(p.price)}` : " · no price"}
                  </option>
                ))}
              </select>

              {newParameter && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    name="newParameterName"
                    label="Parameter name"
                    state={state}
                    placeholder="e.g. Bioactive Zinc"
                  />
                  <Field
                    name="newParameterMatrix"
                    label="Matrix"
                    state={state}
                    placeholder="e.g. BNFF"
                  />
                  <Field
                    name="newParameterUnit"
                    label="Unit"
                    state={state}
                    defaultValue="%"
                  />
                  <Field
                    name="newParameterPrice"
                    label="Price (PKR)"
                    state={state}
                    type="number"
                    step="0.01"
                    placeholder="e.g. 2500"
                  />
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Created and approved immediately, because you are an
                    administrator. It appears in Samples › Parameters like any
                    other, and its rate is what this product bills at.
                  </p>
                </div>
              )}
            </fieldset>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Creating…" : "Create product type"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
