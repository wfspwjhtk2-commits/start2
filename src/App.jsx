import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = {
  USD:"#4f8ef7",EUR:"#f5a623",JPY:"#f74f4f",GBP:"#a855f7",
  CHF:"#10d48e",AUD:"#f97316",CAD:"#06b6d4",CNY:"#f472b6"
};
const FLAGS = {
  USD:"🇺🇸",EUR:"🇪🇺",JPY:"🇯🇵",GBP:"🇬🇧",
  CHF:"🇨🇭",AUD:"🇦🇺",CAD:"🇨🇦",CNY:"🇨🇳"
};
const RATES     = {USD:3.625,EUR:2.15,JPY:0.5,GBP:3.75,CHF:0.25,AUD:4.1,CAD:2.75,CNY:3.1};
const INFLATION = {USD:2.8,EUR:2.2,JPY:2.9,GBP:3.1,CHF:0.8,AUD:3.4,CAD:2.5,CNY:0.5};
const CDS       = {USD:38,EUR:60,JPY:28,GBP:35,CHF:14,AUD:22,CAD:32,CNY:68};
const EPU       = {USD:270,EUR:195,JPY:140,GBP:188,CHF:85,AUD:130,CAD:245,CNY:305};
const CARRY     = {USD:65,EUR:40,JPY:10,GBP:66,CHF:12,AUD:54,CAD:44,CNY:26};
const PERF      = {
  USD:{d30:-2.1},EUR:{d30:2.4},JPY:{d30:2.1},GBP:{d30:1.5},
  CHF:{d30:2.8},AUD:{d30:1.4},CAD:{d30:1.8},CNY:{d30:0.2}
};

function computeScore(code, fg) {
  const ir   = RATES[code];
  const infl = INFLATION[code];
  const real = ir - infl;
  const cdsS = Math.max(0, 100 - CDS[code] / 1.2);
  const epuS = Math.max(0, 80  - EPU[code] / 4.5);
  const fgA  = (fg - 50) / 100;
  const base = 50 + ir*2 + real*1.5 + cdsS*0.14 + epuS*0.10 + CARRY[code]/100*12 + fgA*5;
  const score = Math.max(10, Math.min(92, Math.round(base)));
  const z     = +(0.6745 * (score - 50) / 15).toFixed(2);
  const regime = score >= 60 ? "BULL" : score <= 40 ? "BEAR" : "SIDEWAYS";
  const kelly  = +(Math.min(0.20, Math.max(0,(2*(score/100)-(1-score/100))/2)*0.25)).toFixed(3);
  const perf   = PERF[code].d30;
  return { code, score, z, regime, kelly, realRate:+(ir-infl).toFixed(2),
           trend:`${perf>=0?"+":""}${perf.toFixed(1)}%` };
}

function buildPairs(currencies) {
  const W = {
    "EUR/USD":1.0,"USD/JPY":0.72,"GBP/USD":0.41,"USD/CHF":0.19,
    "USD/CAD":0.18,"AUD/USD":0.17,"EUR/JPY":0.26,"EUR/GBP":0.20,
    "CHF/JPY":0.04,"EUR/CAD":0.06,"CHF/CAD":0.04,"EUR/CNY":0.05,
  };
  const zMap = Object.fromEntries(currencies.map(c=>[c.code,c.z]));
  return Object.entries(W)
    .map(([pair,w]) => {
      const [b,q] = pair.split("/");
      if (!zMap[b]||!zMap[q]) return null;
      const edge = Math.abs(zMap[b]-zMap[q])*w;
      if (edge < 0.25) return null;
      const long = zMap[b] > zMap[q];
      return { pair: long?`${b}/${q}`:`${q}/${b}`, edge:+edge.toFixed(2),
               confidence: Math.min(95, Math.round(50+edge*18)) };
    })
    .filter(Boolean)
    .sort((a,b)=>b.edge-a.edge)
    .slice(0,6);
}

function scoreColor(s) {
  if (s>=70) return "#10d48e";
  if (s>=55) return "#7ef542";
  if (s>=45) return "#f5c842";
  if (s>=35) return "#f58c42";
  return "#f54242";
}
function scoreLabel(s) {
  if (s>=70) return "STARK LONG";
  if (s>=55) return "LONG";
  if (s>=45) return "NEUTRAL";
  if (s>=35) return "SHORT";
  return "STARK SHORT";
}

const MEDALS = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣"];
const C = {bg:"#030608",card:"#06090f",border:"#0d1525",t:"#b0c8e8",dim:"#283050"};

export default function App() {
  const [fg, setFg]       = useState(63);
  const [tab, setTab]     = useState("ranking");
  const [lastUp, setLU]   = useState(new Date());
  const [history, setHist] = useState([]);
  const [tick, setTick]   = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("https://api.alternative.me/fng/?limit=1");
        const j = await r.json();
        setFg(parseInt(j.data[0].value));
      } catch { /* nutzt Fallback 63 */ }
      setLU(new Date());
      setTick(t => t+1);
    }
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  const currencies = ["USD","EUR","JPY","GBP","CHF","AUD","CAD","CNY"]
    .map(c => computeScore(c, fg))
    .sort((a,b) => b.score - a.score);

  const pairs = buildPairs(currencies);

  useEffect(() => {
    const t = new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
    setHist(h => [...h.slice(-59), {
      t,
      CHF: currencies.find(c=>c.code==="CHF")?.score,
      EUR: currencies.find(c=>c.code==="EUR")?.score,
      USD: currencies.find(c=>c.code==="USD")?.score,
      JPY: currencies.find(c=>c.code==="JPY")?.score,
    }]);
  }, [tick]); // eslint-disable-line

  const MKT = [
    ["F&G", fg, fg>60?"#10d48e":fg<40?"#f54242":"#f5c842"],
    ["EUR/USD","1.1834","#f5a623"],
    ["USD/JPY","157.85","#f74f4f"],
    ["Gold","$4878","#f5c842"],
    ["VIX","17.94","#10d48e"],
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.t,
                 fontFamily:"'IBM Plex Mono',monospace,sans-serif",fontSize:12}}>

      {/* TOPBAR */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,
                   padding:"8px 16px",display:"flex",gap:10,alignItems:"center",
                   flexWrap:"wrap",position:"sticky",top:0,zIndex:99}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{width:28,height:28,borderRadius:6,
                       background:"linear-gradient(135deg,#1040e0,#00a0d0)",
                       display:"flex",alignItems:"center",justifyContent:"center",
                       fontSize:10,fontWeight:900,color:"#fff"}}>SQ</div>
          <div>
            <div style={{fontSize:9,fontWeight:800,letterSpacing:3,color:"#5080d0"}}>SENTINEL v19</div>
            <div style={{fontSize:6,color:C.dim}}>FX Quant Dashboard</div>
          </div>
        </div>

        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {MKT.map(([l,v,c])=>(
            <div key={l} style={{padding:"2px 7px",background:C.bg,
                                  border:`1px solid ${C.border}`,borderRadius:3,fontSize:8}}>
              <span style={{color:C.dim}}>{l} </span>
              <span style={{color:c,fontWeight:700}}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"#10d48e",
                       boxShadow:"0 0 6px #10d48e"}}/>
          <span style={{fontSize:7,color:C.dim}}>
            LIVE · {lastUp.toLocaleTimeString("de-DE")}
          </span>
        </div>

        <div style={{width:"100%",display:"flex",gap:3,marginTop:2}}>
          {["ranking","signale","chart"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:"3px 10px",
              background:tab===t?"#1040e022":"transparent",
              border:`1px solid ${tab===t?"#1040e0":C.border}`,
              borderRadius:3,color:tab===t?"#5080d0":C.dim,
              fontSize:7,cursor:"pointer",fontFamily:"inherit"}}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"14px 16px",maxWidth:1000,margin:"0 auto"}}>

        {/* RANKING */}
        {tab==="ranking" && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
            {currencies.map((cur,i) => {
              const sc = scoreColor(cur.score);
              return (
                <div key={cur.code} style={{background:C.card,
                                            border:`1px solid ${sc}22`,borderRadius:8,padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:14}}>{MEDALS[i]}</span>
                    <span style={{fontSize:22}}>{FLAGS[cur.code]}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:800,color:COLORS[cur.code]}}>{cur.code}</div>
                      <div style={{fontSize:7,color:C.dim}}>{scoreLabel(cur.score)}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:20,fontWeight:900,color:sc}}>{cur.score}</div>
                      <div style={{fontSize:7,color:sc}}>{cur.z>=0?"+":""}{cur.z} σ</div>
                    </div>
                  </div>
                  <div style={{height:8,background:"#030608",borderRadius:4,overflow:"hidden",marginBottom:6}}>
                    <div style={{height:"100%",width:`${cur.score}%`,
                                 background:`linear-gradient(90deg,${sc}44,${sc})`,
                                 borderRadius:4,transition:"width 1s ease"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:7}}>
                    <span style={{
                      color:cur.regime==="BULL"?"#10d48e":cur.regime==="BEAR"?"#f54242":"#f5c842",
                      padding:"1px 5px",borderRadius:2,fontWeight:700,
                      background:cur.regime==="BULL"?"#10d48e18":cur.regime==="BEAR"?"#f5424218":"#f5c84218"
                    }}>{cur.regime}</span>
                    <span style={{color:"#3a5070"}}>Kelly {(cur.kelly*100).toFixed(1)}%</span>
                    <span style={{color:cur.trend.startsWith("+")?"#10d48e":"#f54242"}}>{cur.trend}</span>
                    <span style={{color:"#3a5070"}}>Real {cur.realRate.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SIGNALE */}
        {tab==="signale" && (
          <div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,
                         padding:"8px 12px",marginBottom:10,fontSize:8,color:"#3a5080",lineHeight:1.8}}>
              ⚡ Cross-Currency Modified Z-Score Matrix · Kelly-gewichtet · Auto-Update 60s
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
              {pairs.map((p,i) => {
                const c = p.edge>1.8?"#10d48e":p.edge>1.2?"#f5c842":"#f58c42";
                return (
                  <div key={i} style={{background:C.card,border:`1px solid ${c}28`,
                                       borderRadius:8,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:14,fontWeight:900,color:"#5080a0"}}>{p.pair}</span>
                      <span style={{fontSize:13,fontWeight:900,color:"#10d48e"}}>▲ LONG</span>
                    </div>
                    <div style={{fontSize:7,color:c,marginBottom:5}}>
                      Edge {p.edge} · Konfidenz {p.confidence}%
                    </div>
                    <div style={{height:4,background:"#030608",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${p.confidence}%`,background:c}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CHART */}
        {tab==="chart" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,
                       borderRadius:8,padding:"16px"}}>
            <div style={{fontSize:9,color:C.dim,letterSpacing:2,marginBottom:14}}>
              SCORE-VERLAUF · letzte {history.length} Min · Live-Update 60s
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={history}>
                <XAxis dataKey="t" tick={{fill:"#283050",fontSize:7}}
                       tickLine={false} interval="preserveStartEnd"/>
                <YAxis domain={[20,90]} tick={{fill:"#283050",fontSize:7}} tickLine={false}/>
                <Tooltip contentStyle={{background:"#06090f",
                                        border:"1px solid #0d1525",fontSize:9}}/>
                {["CHF","EUR","USD","JPY"].map(code=>(
                  <Line key={code} type="monotone" dataKey={code}
                        stroke={COLORS[code]} strokeWidth={2}
                        dot={false} isAnimationActive={false}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:10}}>
              {["CHF","EUR","USD","JPY"].map(c=>(
                <span key={c} style={{fontSize:8}}>
                  <span style={{color:COLORS[c],fontWeight:700}}>── </span>{c}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{marginTop:12,textAlign:"center",fontSize:6,color:"#080c16"}}>
          SENTINEL v19 · Kein Finanzberater · Modified Z-Score · Auto-Refresh 60s
        </div>
      </div>
    </div>
  );
}
