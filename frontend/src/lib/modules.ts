export const platformModules = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    focus: "Cadena de valor global y restricciones entre areas",
    section: "control",
    processOrder: 0,
  },
  {
    key: "granos",
    label: "1. Recepcion de Granos",
    href: "/granos",
    focus: "Calidad de trigo/maiz, humedad y variabilidad de proveedores",
    section: "operacion",
    processOrder: 1,
  },
  {
    key: "tolvas",
    label: "2. Limpieza y Tolvas",
    href: "/tolvas",
    focus: "Distribucion, limpieza y estabilidad de flujo de materia prima",
    section: "operacion",
    processOrder: 2,
  },
  {
    key: "molienda",
    label: "3. Molienda",
    href: "/molienda",
    focus: "Setpoints de rodillos, extraccion, energia y paros",
    section: "operacion",
    processOrder: 3,
  },
  {
    key: "produccion",
    label: "4. Produccion",
    href: "/produccion",
    focus: "Lotes en proceso, capacidad efectiva y continuidad operativa",
    section: "operacion",
    processOrder: 4,
  },
  {
    key: "calidad",
    label: "5. Calidad",
    href: "/calidad",
    focus: "Proteina, cenizas, alveografo y conformidad por lote",
    section: "operacion",
    processOrder: 5,
  },
  {
    key: "harina",
    label: "6. Harina",
    href: "/harina",
    focus: "Liberacion de lotes de harina y control de reclamos",
    section: "operacion",
    processOrder: 6,
  },
  {
    key: "empaques",
    label: "7. Empaques",
    href: "/empaques",
    focus: "Presentaciones, peso objetivo y merma de empaque",
    section: "operacion",
    processOrder: 7,
  },
  {
    key: "almacenes",
    label: "8. Almacenes",
    href: "/almacenes",
    focus: "Inventario de producto final y preparacion de despacho",
    section: "operacion",
    processOrder: 8,
  },
  {
    key: "ventas",
    label: "9. Ventas y Entrega",
    href: "/ventas",
    focus: "Pedido, precio, servicio y registro de entrega al cliente",
    section: "operacion",
    processOrder: 9,
  },
  {
    key: "procesos",
    label: "Wizard de Flujo",
    href: "/procesos",
    focus: "Captura transversal de grano a cliente en un solo recorrido",
    section: "control",
    processOrder: 10,
  },
  {
    key: "rentabilidad",
    label: "Rentabilidad",
    href: "/rentabilidad",
    focus: "Palancas de margen, mezcla de producto y volatilidad de costos",
    section: "control",
    processOrder: 11,
  },
  {
    key: "twinmill",
    label: "TwinMill",
    href: "/twinmill",
    focus: "Vista integral de proceso y modelo fisico del gemelo digital",
    section: "control",
    processOrder: 12,
  },
  {
    key: "ia",
    label: "IA Data Science Lab",
    href: "/ia",
    focus: "Algoritmos, laboratorio analitico y simulaciones avanzadas",
    section: "control",
    processOrder: 13,
  },
  {
    key: "catalogos",
    label: "Catalogos",
    href: "/catalogos",
    focus: "Maestros para formularios operativos y trazabilidad",
    section: "configuracion",
    processOrder: 14,
  },
  {
    key: "disenador",
    label: "Diseñador de Molino",
    href: "/disenador",
    focus: "Constructor inteligente de diagrama de proceso con IA y catálogo de maquinaria real",
    section: "control",
    processOrder: 15,
  },
] as const;

export type ModuleKey =
  | (typeof platformModules)[number]["key"]
  | "procesos"
  | "molienda"
  | "harina";

export function getModuleByKey(key: string) {
  return platformModules.find((item) => item.key === key);
}
