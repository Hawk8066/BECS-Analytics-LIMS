"use client";

import { useRef, useState } from "react";
import { addInventoryItem } from "@/lib/actions/inventory";
import {
  INVENTORY_CATEGORIES,
  hasExpiry,
  hasPackaging,
  hasSpecification,
  isEquipment,
} from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

// "Add item" popup for a store. Fields adapt to the category: equipment has a
// specification + accessories (no packing size); others have packing size + unit;
// only consumables/chemicals have an expiry date.
export function AddItemButton({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [accKeys, setAccKeys] = useState<number[]>([0]);
  const accSeq = useRef(1);

  const packaging = hasPackaging(category);
  const specification = hasSpecification(category);
  const equipment = isEquipment(category);
  const expiry = hasExpiry(category);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Add item
      </Button>
      {open && (
        <Modal
          title="Add item"
          onClose={() => setOpen(false)}
          className="max-w-xl"
        >
          <form
            action={addInventoryItem}
            onSubmit={() => setOpen(false)}
            className="grid gap-4"
          >
            <input type="hidden" name="storeId" value={storeId} />

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-9 rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {INVENTORY_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" autoComplete="off" required />
              </div>
            </div>

            {packaging && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="pack">Packing size</Label>
                  <Input id="pack" name="pack" placeholder="e.g. 500" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="unit">Unit</Label>
                  <Input id="unit" name="unit" placeholder="e.g. g, mL" />
                </div>
              </div>
            )}

            {specification && (
              <div className="grid gap-1.5">
                <Label htmlFor="specification">Specification</Label>
                <Input
                  id="specification"
                  name="specification"
                  placeholder={
                    equipment ? "Model / spec details" : "e.g. 100 mL, Class A"
                  }
                />
              </div>
            )}

            {equipment && (
              <>
                <div className="grid gap-1.5">
                  <Label>Accessories</Label>
                  <div className="grid gap-2">
                    {accKeys.map((k) => (
                      <div key={k} className="flex items-center gap-2">
                        <Input
                          name="accessory"
                          placeholder="Accessory"
                          className="flex-1"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setAccKeys((ks) =>
                              ks.length > 1 ? ks.filter((x) => x !== k) : ks,
                            )
                          }
                          aria-label="Remove accessory"
                          className="text-muted-foreground hover:text-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-self-start"
                    onClick={() =>
                      setAccKeys((ks) => [...ks, accSeq.current++])
                    }
                  >
                    ＋ Add accessory
                  </Button>
                </div>
              </>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="0"
                  defaultValue="1"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="reorderLevel">Threshold</Label>
                <Input
                  id="reorderLevel"
                  name="reorderLevel"
                  type="number"
                  min="0"
                  placeholder="Reorder at"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="make">Make</Label>
                <Input id="make" name="make" placeholder="Brand" />
              </div>
            </div>

            {expiry && (
              <div className="grid max-w-[220px] gap-1.5">
                <Label htmlFor="expiryDate">Expiry date</Label>
                <Input id="expiryDate" name="expiryDate" type="date" />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Add item
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
