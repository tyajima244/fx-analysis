from pathlib import Path
import json
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
OUT = ROOT / 'frontend' / 'data'
OUT.mkdir(parents=True, exist_ok=True)

files = sorted(DATA.glob('USDJPY_M1_*.csv'))
if not files:
    raise SystemExit('data/ に USDJPY_M1_YYYYMM.csv を置いてください')
frames=[]
for f in files:
    x=pd.read_csv(f, encoding='utf-8-sig')
    x['time']=pd.to_datetime(x['time'], format='%Y.%m.%d %H:%M')
    frames.append(x)
df=pd.concat(frames, ignore_index=True).drop_duplicates('time').sort_values('time').set_index('time')

rules={'M1':'1min','M5':'5min','M15':'15min','H1':'1h','H4':'4h','D1':'1D'}

def rsi(s, n=14):
    d=s.diff(); up=d.clip(lower=0); dn=-d.clip(upper=0)
    au=up.ewm(alpha=1/n, adjust=False, min_periods=n).mean()
    ad=dn.ewm(alpha=1/n, adjust=False, min_periods=n).mean()
    rs=au/ad.replace(0,np.nan)
    return 100-(100/(1+rs))

def enrich(x):
    c=x['close']
    x=x.copy()
    x['sma20']=c.rolling(20).mean()
    x['sma75']=c.rolling(75).mean()
    x['ema20']=c.ewm(span=20, adjust=False).mean()
    std=c.rolling(20).std(ddof=0)
    mid=x['sma20']
    for k in (2,3):
        x[f'bb{k}_upper']=mid+k*std
        x[f'bb{k}_lower']=mid-k*std
    x['rsi14']=rsi(c,14)
    return x

for name, rule in rules.items():
    if name=='M1': x=df.copy()
    else:
        x=df.resample(rule, label='left', closed='left').agg({
            'open':'first','high':'max','low':'min','close':'last','tick_volume':'sum'
        }).dropna(subset=['open','high','low','close'])
    x=enrich(x).reset_index()
    rows=[]
    cols=['open','high','low','close','tick_volume','sma20','sma75','ema20','bb2_upper','bb2_lower','bb3_upper','bb3_lower','rsi14']
    for _,r in x.iterrows():
        d={'time':int(r['time'].timestamp())}
        for c in cols:
            v=r[c]
            d[c]=None if pd.isna(v) else (int(v) if c=='tick_volume' else round(float(v),6))
        rows.append(d)
    (OUT/f'{name}.json').write_text(json.dumps(rows,separators=(',',':')), encoding='utf-8')
    print(name, len(rows))
