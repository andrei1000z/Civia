// Core types for Civia platform

export type Sector = "S1" | "S2" | "S3" | "S4" | "S5" | "S6";

export type SesizareStatus = "nou" | "in-lucru" | "rezolvat" | "respins";

export type SesizareTip =
  | "groapa"
  | "trotuar"
  | "iluminat"
  | "copac"
  | "gunoi"
  | "parcare"
  | "stalpisori"
  | "canalizare"
  | "semafor"
  | "pietonal"
  | "graffiti"
  | "mobilier"
  | "zgomot"
  | "animale"
  | "transport"
  | "afisaj"
  | "altele";

export interface Sesizare {
  id: string;
  tip: SesizareTip;
  titlu: string;
  locatie: string;
  sector: Sector;
  coords: [number, number]; // [lat, lng]
  status: SesizareStatus;
  data: string; // ISO date
  autor: string;
  descriere: string;
  voturi: number;
  comentarii: number;
  imagini: string[];
  publica: boolean;
}

export type AccidentSeverity = 1 | 2 | 3;
export type AccidentType = "rutier" | "pieton" | "biciclist";

export interface Accident {
  id: string;
  lat: number;
  lng: number;
  severity: AccidentSeverity;
  data: string;
  type: AccidentType;
  strada: string;
  victime: number;
}

export type StireSource =
  | "Buletin de București"
  | "B365.ro"
  | "Hotnews București"
  | "Digi24"
  | "Euronews România"
  | "G4Media";

export type StireCategory =
  | "transport"
  | "urbanism"
  | "mediu"
  | "siguranta"
  | "administratie"
  | "eveniment";

export interface Stire {
  id: string;
  source: StireSource;
  category: StireCategory;
  title: string;
  excerpt: string;
  body: string;
  author: string;
  publishedAt: string;
  readingMinutes: number;
  featured?: boolean;
  imageGradient: string;
}

export type EvenimentCategory =
  | "accident"
  | "incendiu"
  | "inundatie"
  | "cutremur"
  | "protest"
  | "infrastructura";

export type EvenimentSeverity = "minor" | "moderat" | "major" | "critic";

export interface Eveniment {
  id: string;
  slug: string;
  titlu: string;
  data: string;
  county: string; // county ID e.g. "B", "CJ", "GL"
  category: EvenimentCategory;
  severity: EvenimentSeverity;
  descriere: string;
  gradient: string;
  image?: string; // relative path under /images/evenimente/ (without extension)
  victime?: number;
  evacuati?: number;
  echipaje?: number;
}

export type OperatorTransport = "stb" | "metrorex" | "ilfov";

export interface Bilet {
  id: string;
  operator: OperatorTransport;
  nume: string;
  pret: number;
  validitate: string;
  descriere: string;
  undeCumperi: string[];
  accepteCardBancar: boolean;
  icon: string;
}

export interface Linie {
  id: string;
  operator: OperatorTransport;
  numar: string;
  tip: "autobuz" | "tramvai" | "troleibuz" | "metrou" | "nocturna";
  culoare: string;
  traseu: string[];
  frecventa: string;
  primaCursa: string;
  ultimaCursa: string;
}

export interface Primar {
  id: string;
  nume: string;
  partid: string;
  culoarePartid: string;
  perioada: string;
  anInceput: number;
  anSfarsit: number | null;
  viceprimari: string[];
  realizari: string[];
  controverse: string[];
  proiecte: string[];
  rating: number;
  initiale: string;
  photo?: string; // filename (without extension) under /images/primari/
}

export interface ConsiliuGeneral {
  perioada: string;
  compozitie: { partid: string; procent: number; culoare: string }[];
}

export interface Ghid {
  id: string;
  slug: string;
  titlu: string;
  descriere: string;
  capitole: number;
  dificultate: "usor" | "mediu" | "avansat";
  timpCitire: number;
  icon: string;
  gradient: string;
  image?: string; // filename (without extension) under /images/ghiduri/
}

export interface GhidChapter {
  id: number;
  titlu: string;
  slug: string;
}

export interface TimelineEntry {
  time: string;
  titlu: string;
  descriere: string;
  icon?: string;
}

export interface Statistica {
  id: string;
  label: string;
  valoare: number | string;
  trend?: "up" | "down" | "stable";
  delta?: string;
  unitate?: string;
}

export interface BicyclePath {
  id: string;
  name: string;
  type: "dedicata" | "marcata" | "recomandata";
  coords: [number, number][];
  length: number;
}

export interface MetroStation {
  id: string;
  name: string;
  lines: string[];
  coords: [number, number];
}

export interface MetroLine {
  id: string;
  name: string;
  color: string;
  stations: string[];
  coords: [number, number][];
}

export interface POI {
  id: string;
  name: string;
  type: "parc" | "zona-pietonala" | "traversare" | "fantana" | "piscina";
  coords: [number, number];
  description?: string;
}

export interface MonthlyData {
  month: string;
  value: number;
  [key: string]: string | number;
}

export interface SectorData {
  sector: string;
  value: number;
  [key: string]: string | number;
}
