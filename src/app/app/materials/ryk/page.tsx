import { MaterialsRegister } from "../materials-register";

export default async function RykMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  return <MaterialsRegister slug="ryk" searchParams={searchParams} />;
}
