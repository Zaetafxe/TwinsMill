export type CatalogItem = {
  id: string;
  label: string;
};

export const fallbackGrainCatalogs = {
  grain_varieties: [
    { id: "trigo-suave", label: "Trigo suave" },
    { id: "trigo-duro", label: "Trigo duro" },
    { id: "trigo-panificable", label: "Trigo panificable" },
  ],
  grain_warehouses: [
    { id: "bg-norte-1", label: "Bodega Norte 1" },
    { id: "bg-sur-1", label: "Bodega Sur 1" },
  ],
  flour_warehouses: [
    { id: "alm-harina-a", label: "Almacen Harina A" },
    { id: "alm-harina-b", label: "Almacen Harina B" },
  ],
  flour_types: [
    { id: "harina-premium", label: "Harina premium" },
    { id: "harina-estandar", label: "Harina estandar" },
    { id: "harina-integral", label: "Harina integral" },
  ],
  flour_lines: [
    { id: "linea-a", label: "Linea A" },
    { id: "linea-b", label: "Linea B" },
    { id: "linea-c", label: "Linea C" },
  ],
  packed_products: [
    { id: "prod-25kg", label: "Harina 25 kg" },
    { id: "prod-10kg", label: "Harina 10 kg" },
    { id: "prod-1kg", label: "Harina 1 kg" },
  ],
  packaging_units: [
    { id: "saco", label: "Saco" },
    { id: "bolsa", label: "Bolsa" },
    { id: "bigbag", label: "Big bag" },
  ],
  sites: [
    { id: "sede-cdmx", label: "CDMX" },
    { id: "sede-guadalajara", label: "Guadalajara" },
    { id: "sede-monterrey", label: "Monterrey" },
  ],
  customers: [
    { id: "cli-pan-norte", label: "Panificadora Norte" },
    { id: "cli-foodservice", label: "Foodservice Central" },
    { id: "cli-galleta-plus", label: "Galleta Plus" },
  ],
  customer_types: [
    { id: "industrial", label: "Industrial" },
    { id: "retail", label: "Retail" },
    { id: "foodservice", label: "Foodservice" },
  ],
  farmers: [
    { id: "agr-san-jose", label: "Agricola San Jose" },
    { id: "agr-valle-verde", label: "Valle Verde" },
    { id: "agr-campo-alto", label: "Campo Alto" },
  ],
} satisfies Record<string, CatalogItem[]>;
