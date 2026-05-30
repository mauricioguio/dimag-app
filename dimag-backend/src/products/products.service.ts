import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// ── Size charts (body measurements in cm) ────────────────────────────────────
type CR = { max: number; size: string };
const S_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const W_BUST:  CR[] = [{max:85,size:'XS'},{max:90,size:'S'},{max:95,size:'M'},{max:100,size:'L'},{max:105,size:'XL'},{max:112,size:'XXL'},{max:9999,size:'XXXL'}];
const W_WAIST: CR[] = [{max:72,size:'XS'},{max:78,size:'S'},{max:84,size:'M'},{max: 91,size:'L'},{max:100,size:'XL'},{max:108,size:'XXL'},{max:9999,size:'XXXL'}];
const W_HIP:   CR[] = [{max:92,size:'XS'},{max:97,size:'S'},{max:102,size:'M'},{max:108,size:'L'},{max:114,size:'XL'},{max:121,size:'XXL'},{max:9999,size:'XXXL'}];
const M_CHEST: CR[] = [{max:88,size:'XS'},{max:94,size:'S'},{max:100,size:'M'},{max:106,size:'L'},{max:112,size:'XL'},{max:118,size:'XXL'},{max:9999,size:'XXXL'}];
const M_WAIST: CR[] = [{max:76,size:'XS'},{max:82,size:'S'},{max:88,size:'M'},{max: 94,size:'L'},{max:100,size:'XL'},{max:106,size:'XXL'},{max:9999,size:'XXXL'}];
const M_HIP:   CR[] = [{max:88,size:'XS'},{max:94,size:'S'},{max:100,size:'M'},{max:106,size:'L'},{max:112,size:'XL'},{max:118,size:'XXL'},{max:9999,size:'XXXL'}];

function sizeOf(cm: number, chart: CR[]): string {
  return chart.find(r => cm <= r.max)?.size ?? chart[chart.length - 1].size;
}

/** cm remaining to the upper limit of the matching size (0 = at limit, negative = over) */
function dToMax(cm: number, chart: CR[]): number {
  const e = chart.find(r => cm <= r.max);
  return e ? e.max - cm : -(cm - chart[chart.length - 1].max);
}

/** how many cm above the PREVIOUS size's upper limit (= how far into current size from below) */
function dFromPrevMax(cm: number, chart: CR[]): number {
  const i = chart.findIndex(r => cm <= r.max);
  if (i <= 0) return 999; // at XS, no smaller size exists
  return cm - chart[i - 1].max;
}

function sIdx(s: string): number { return S_ORDER.indexOf(s.toUpperCase()); }
function larger(a: string, b: string): string { return sIdx(a) >= sIdx(b) ? a : b; }

function closest(size: string, available: string[]): string | null {
  if (!available.length) return null;
  const exact = available.find(s => s.toUpperCase() === size.toUpperCase());
  if (exact) return exact;
  const i = sIdx(size);
  for (let d = 1; d <= S_ORDER.length; d++) {
    const up = i + d < S_ORDER.length ? available.find(s => s.toUpperCase() === S_ORDER[i + d]) : undefined;
    const dn = i - d >= 0             ? available.find(s => s.toUpperCase() === S_ORDER[i - d]) : undefined;
    if (up) return up;
    if (dn) return dn;
  }
  return available[0];
}

interface SizeRec { size: string; note: string }

function computeTopRec(
  bust: number | undefined, waist: number | undefined,
  bustC: CR[], waistC: CR[],
  pref: string | undefined, available: string[],
): SizeRec | null {
  const bSize = bust  && bust  > 50 ? sizeOf(bust,  bustC)  : null;
  const wSize = waist && waist > 50 ? sizeOf(waist, waistC) : null;
  if (!bSize && !wSize) return null;

  const baseSize = bSize && wSize ? larger(bSize, wSize) : (bSize ?? wSize!);
  const baseIdx  = sIdx(baseSize);

  // distance to upper limit (most constrained measurement)
  const upMargins: number[] = [];
  if (bust  && bust  > 50) upMargins.push(dToMax(bust,  bustC));
  if (waist && waist > 50) upMargins.push(dToMax(waist, waistC));
  const minUp = Math.min(...upMargins);

  // distance from previous size's upper limit (how far into current size from below)
  const downMargins: number[] = [];
  if (bust  && bust  > 50) downMargins.push(dFromPrevMax(bust,  bustC));
  if (waist && waist > 50) downMargins.push(dFromPrevMax(waist, waistC));
  const minDown = Math.min(...downMargins);

  let finalSize = baseSize;
  let note      = '';

  if (minUp < 0) {
    // Over chart max → must go up
    const next = S_ORDER[Math.min(baseIdx + 1, S_ORDER.length - 1)];
    finalSize = next;
    note = `medida ${Math.abs(minUp)} cm por encima del tope de ${baseSize}; se recomienda ${next}`;
  } else if (pref === 'suelto' && minUp <= 2) {
    // Near upper limit + suelto → upsize for room
    const next = S_ORDER[Math.min(baseIdx + 1, S_ORDER.length - 1)];
    if (next !== baseSize) {
      finalSize = next;
      note = `medida a ${minUp} cm del tope de ${baseSize}; preferencia suelta → ${next} para mayor holgura`;
    } else {
      note = `talla ${baseSize} según tabla`;
    }
  } else if (pref === 'ajustado' && minUp <= 2) {
    // Near upper limit + ajustado → stay, fabric absorbs
    note = `medida a ${minUp} cm del tope de ${baseSize}; el licrado absorbe la diferencia quedando ceñido en ${baseSize}`;
  } else if (pref === 'ajustado' && minDown <= 3 && baseIdx > 0) {
    // Near lower limit + ajustado → downsize, fabric in smaller size stretches to fit snugly
    const prev = S_ORDER[baseIdx - 1];
    finalSize = prev;
    note = `medida ${minDown} cm sobre el tope de ${prev}; con preferencia ajustada el licrado estira para un ajuste ceñido en ${prev}`;
  } else {
    note = `medida corresponde a ${baseSize} según la tabla`;
  }

  const avail = closest(finalSize, available);
  return { size: avail ?? finalSize, note };
}

function computeBottomRec(
  hip: number | undefined, hipC: CR[],
  pref: string | undefined, available: string[],
): SizeRec | null {
  if (!hip || hip <= 50) return null;
  const baseSize = sizeOf(hip, hipC);
  const baseIdx  = sIdx(baseSize);
  const minUp    = dToMax(hip, hipC);
  const minDown  = dFromPrevMax(hip, hipC);

  let finalSize = baseSize;
  let note      = '';

  if (minUp < 0) {
    const next = S_ORDER[Math.min(baseIdx + 1, S_ORDER.length - 1)];
    finalSize = next;
    note = `cadera ${Math.abs(minUp)} cm sobre el tope de ${baseSize}; se recomienda ${next}`;
  } else if (pref === 'suelto' && minUp <= 2) {
    const next = S_ORDER[Math.min(baseIdx + 1, S_ORDER.length - 1)];
    if (next !== baseSize) {
      finalSize = next;
      note = `cadera a ${minUp} cm del tope de ${baseSize}; preferencia suelta → ${next}`;
    } else {
      note = `talla ${baseSize} según tabla`;
    }
  } else if (pref === 'ajustado' && minUp <= 2) {
    note = `cadera a ${minUp} cm del tope de ${baseSize}; el licrado absorbe la diferencia, queda ceñido en ${baseSize}`;
  } else if (pref === 'ajustado' && minDown <= 3 && baseIdx > 0) {
    const prev = S_ORDER[baseIdx - 1];
    finalSize = prev;
    note = `cadera ${minDown} cm sobre el tope de ${prev}; el licrado estira para ajuste ceñido en ${prev}`;
  } else {
    note = `cadera corresponde a ${baseSize} según tabla`;
  }

  const avail = closest(finalSize, available);
  return { size: avail ?? finalSize, note };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}


  async findAll(onlyActive = true) {
    const list = await this.prisma.product.findMany({
      where: onlyActive ? ({ active: true } as any) : undefined,
      orderBy: { name: 'asc' },
    });
    return list.map(p => ({ ...p, type: p.type.toLowerCase() }));
  }

  async patchActive(id: string, active: boolean) {
    const p = await this.prisma.product.update({ where: { id }, data: { active } });
    return { ...p, type: p.type.toLowerCase() };
  }

  async patchCollection(id: string, collection: string) {
    const p = await this.prisma.product.update({ where: { id }, data: { collection } });
    return { ...p, type: p.type.toLowerCase() };
  }

  async findOne(id: string) {
    const p = await this.prisma.product.findFirst({
      where: { id, ...({ active: true } as any) },
    });
    return p ? { ...p, type: p.type.toLowerCase() } : null;
  }

  async create(data: any) {
    const p = await this.prisma.product.create({
      data: { ...data, type: (data.type as string).toUpperCase() as any },
    });
    return { ...p, type: p.type.toLowerCase() };
  }

  async update(id: string, data: any) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
    const p = await this.prisma.product.update({
      where: { id },
      data: { ...rest, type: (rest.type as string).toUpperCase() as any },
    });
    return { ...p, type: p.type.toLowerCase() };
  }

  async remove(id: string) {
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }

  async getSizeAdvice(dto: {
    bust?: number; waist?: number; hip?: number;
    gender: string; type: string; productName: string;
    topSizes: string[]; bottomSizes: string[];
    fitPreference?: string;
    history?: { role: 'user' | 'model'; text: string }[];
  }): Promise<{ advice: string; isError?: boolean }> {
    const isMale  = dto.gender === 'hombre';
    const bustC   = isMale ? M_CHEST : W_BUST;
    const waistC  = isMale ? M_WAIST : W_WAIST;
    const hipC    = isMale ? M_HIP   : W_HIP;

    const measurements: string[] = [];
    if (dto.bust)  measurements.push(`Busto: ${dto.bust} cm`);
    if (dto.waist) measurements.push(`Cintura: ${dto.waist} cm`);
    if (dto.hip)   measurements.push(`Cadera: ${dto.hip} cm`);

    // Pre-compute recommendations in TypeScript (reliable math)
    const topRec    = dto.topSizes.length    ? computeTopRec(dto.bust, dto.waist, bustC, waistC, dto.fitPreference, dto.topSizes)    : null;
    const bottomRec = dto.bottomSizes.length ? computeBottomRec(dto.hip, hipC, dto.fitPreference, dto.bottomSizes)                  : null;

    const recLines: string[] = [];
    if (topRec)    recLines.push(`Blusa/Top → ${topRec.size}  [${topRec.note}]`);
    if (bottomRec) recLines.push(`Pantalón  → ${bottomRec.size}  [${bottomRec.note}]`);

    const fitText = dto.fitPreference === 'ajustado' ? 'ajustado/ceñido'
      : dto.fitPreference === 'suelto' ? 'suelto/holgado'
      : 'normal/estándar';

    const prompt = `Eres una asistente experta en tallas de Guiio Uniformes (uniformes médicos en Colombia). El tejido es antifluido licrado con 20-25% de elasticidad.

Producto: ${dto.productName} (${dto.gender})
Medidas del cliente: ${measurements.join(' | ')}
Preferencia de ajuste: ${fitText}

TALLAS RECOMENDADAS (ya calculadas por el sistema, DEBES usarlas exactamente):
${recLines.length ? recLines.join('\n') : 'Sin medidas suficientes para calcular.'}

Escribe 2-3 oraciones amigables en español dirigidas al cliente. Confirma las tallas recomendadas tal como están arriba, explica brevemente la razón mencionando la preferencia de ajuste y el comportamiento del tejido elástico. Tono cálido y directo. Sin asteriscos ni markdown.`;

    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }];
    if (dto.history?.length) {
      for (const msg of dto.history) {
        contents.push({ role: msg.role, parts: [{ text: msg.text }] });
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    const json = await res.json() as any;

    if (!res.ok || json?.error) {
      const code = json?.error?.code as number | undefined;
      const msg  = (json?.error?.message ?? '').toLowerCase();
      if (code === 429 || msg.includes('quota') || msg.includes('exhausted') || msg.includes('rate limit')) {
        return { advice: 'Se alcanzó el límite de solicitudes de IA por hoy. Puedes ver la talla recomendada en la barra de abajo.', isError: true };
      }
      return { advice: 'Error al conectar con el servicio de IA. Intenta de nuevo en unos momentos.', isError: true };
    }

    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { advice: 'No se pudo generar la sugerencia. Intenta de nuevo.', isError: true };
    return { advice: text };
  }
}
