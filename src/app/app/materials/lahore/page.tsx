import { MaterialsRegister } from "../materials-register";

export default async function LahoreMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  return <MaterialsRegister slug="lahore" searchParams={searchParams} />;
}
