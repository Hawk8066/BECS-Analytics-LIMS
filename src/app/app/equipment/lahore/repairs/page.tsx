import { RepairRegister } from "../../repair-register";

export default async function LahoreRepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  return <RepairRegister slug="lahore" searchParams={searchParams} />;
}
