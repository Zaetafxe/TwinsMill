import { CatalogsManager } from "@/components/CatalogsManager";

export default function CatalogosPage() {
  return (
    <main className="mx-auto max-w-[1480px] px-4 pb-8 pt-6 md:px-8">
      <section className="panel mb-6 p-5 md:p-6">
        <p className="section-kicker">Maestros de Datos</p>
        <h1 className="section-title font-display text-3xl md:text-5xl">Catalogos</h1>
        <p className="section-copy ops-copy mt-2 max-w-4xl text-sm text-slate-600">
          Centro de catalogos para mantener materiales, productos, clientes y parametros base que alimentan combobox en los formularios operativos.
        </p>
      </section>
      <CatalogsManager />
    </main>
  );
}
