import { NewMaterial } from "../../new-material";

export default async function LahoreNewMaterialPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  return <NewMaterial slug="lahore" searchParams={searchParams} />;
}
