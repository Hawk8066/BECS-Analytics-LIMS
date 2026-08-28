import { RepairRegister } from "../../repair-register";

export default async function RykRepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  return <RepairRegister slug="ryk" searchParams={searchParams} />;
}
