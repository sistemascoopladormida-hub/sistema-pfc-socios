import { getSociosPFC } from "@/lib/readSociosExcel";
import { SociosPageClient } from "@/modules/socios/socios-page-client";

export default async function SociosPage() {
  try {
    const socios = await getSociosPFC();
    return <SociosPageClient socios={socios} />;
  } catch {
    return (
      <SociosPageClient
        socios={[]}
        loadError="No se pudo leer el archivo Excel. Verifica que exista en data/socios_pfc.xlsx (o en la raiz del proyecto)."
      />
    );
  }
}
