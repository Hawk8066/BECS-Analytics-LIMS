import { NewMaterial } from "../../new-material";

export default async function RykNewMaterialPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  return <NewMaterial slug="ryk" searchParams={searchParams} />;
}
