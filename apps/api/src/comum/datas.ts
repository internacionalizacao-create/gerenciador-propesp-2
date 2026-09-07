const MILISSEGUNDOS_POR_DIA = 86_400_000;

/**
 * Conta dias civis incluindo saida e retorno.
 *
 * O calculo usa UTC para nunca perder ou ganhar um dia por fuso horario ou
 * horario de verao. As datas ja chegam validadas no formato ISO do Postgres.
 */
export function calcularDiasInclusivos(
  dataInicio: string,
  dataFim: string,
): number {
  const inicio = instanteUtc(dataInicio);
  const fim = instanteUtc(dataFim);
  return Math.floor((fim - inicio) / MILISSEGUNDOS_POR_DIA) + 1;
}

function instanteUtc(data: string): number {
  const [ano, mes, dia] = data.split('-').map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

/**
 * Data de hoje no fuso institucional, em `AAAA-MM-DD`.
 *
 * `America/Manaus` e nao o fuso do servidor: um envio feito as 22h de Manaus
 * cairia no dia seguinte se a data viesse em UTC, e a prestacao ficaria
 * registrada como enviada num dia em que ninguem trabalhou. Estava duplicado em
 * `bolsistas.service.ts`; a terceira repeticao viraria divergencia.
 */
export function dataHojeEmManaus(data = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Manaus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(data);
  const valor = Object.fromEntries(
    partes.map((parte) => [parte.type, parte.value]),
  );
  return `${valor.year}-${valor.month}-${valor.day}`;
}

/**
 * Dias civis decorridos desde um instante, no fuso institucional (CG-047).
 *
 * Conta **dias de calendario**, nao periodos de 24 horas: uma missao enviada
 * ontem as 23h espera "1 dia", nao "0". A fila existe para responder "ha quanto
 * tempo isto esta parado", e quem olha pensa em dias do calendario — arredondar
 * por hora faria o numero mudar ao longo do dia sem nada ter acontecido.
 */
export function diasDesde(instante: Date, agora = new Date()): number {
  const de = dataHojeEmManaus(instante);
  const ate = dataHojeEmManaus(agora);
  return Math.max(0, calcularDiasInclusivos(de, ate) - 1);
}
