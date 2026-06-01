import { FetchOptions, SimpleAdapter } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import { httpGet } from "../../utils/fetchURL";

const API = "https://api.qfex.com";

const fetch = async (options: FetchOptions) => {
  const fromISO = new Date(options.startTimestamp * 1000).toISOString();
  const toISO = new Date(options.endTimestamp * 1000).toISOString();

  // 1) Get all active symbols
  const refdata = await httpGet(`${API}/refdata`);
  const symbols: string[] = (refdata.data || [])
    .filter((s: any) => s.status === "ACTIVE")
    .map((s: any) => s.symbol);

  let dailyVolume = 0;
  let openInterestAtEnd = 0;

  // 2) For each symbol, fetch taker volume + OI in parallel
  await Promise.all(
    symbols.map(async (symbol) => {
      const encoded = encodeURIComponent(symbol);

      const tv = await httpGet(
        `${API}/taker-volume/${encoded}?intervalMinutes=1440&fromISO=${fromISO}&toISO=${toISO}`
      );
      (tv.data || []).forEach((p: any) => {
        dailyVolume += (p.takerBuyNotional || 0) + (p.takerSellNotional || 0);
      });

      const oi = await httpGet(
        `${API}/open-interest/${encoded}?intervalMinutes=1440&fromISO=${fromISO}&toISO=${toISO}`
      );
      const points = oi.data || [];
      if (points.length > 0) {
        const last = points[points.length - 1].openInterest;
        if (last) openInterestAtEnd += last;
      }
    })
  );

  return {
    dailyVolume,
    openInterestAtEnd,
  };
};

const adapter: SimpleAdapter = {
  version: 2,
  fetch,
  chains: [CHAIN.ARBITRUM],
  start: '2026-03-05',
  methodology: {
    Volume:
      'Daily perpetual trading volume on QFEX, computed as the sum of taker buy and sell notionals across all active symbols, sourced from the QFEX public market-data API (/taker-volume).',
    OpenInterest:
      'Open interest at the end of the period, summed across all active QFEX symbols, sourced from the QFEX public market-data API (/open-interest).',
  },
};

export default adapter;
