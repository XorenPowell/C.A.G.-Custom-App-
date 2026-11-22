/* Mock data. Shaped like the real tables so the mockup argues honestly about
   what the schema would need. TODAY is pinned so the demo never goes stale. */
const TODAY = "2026-11-04";
const d = (iso) => { const [y,m,dd]=iso.split("-").map(Number); return new Date(y,m-1,dd); };
const days = (a,b) => Math.round((d(b)-d(a))/864e5);
const shift = (iso,n) => { const x=d(iso); x.setDate(x.getDate()+n);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`; };
const fmt = (iso) => iso ? `${d(iso).getMonth()+1}/${d(iso).getDate()}/${String(d(iso).getFullYear()).slice(2)}` : "—";
const fmtLong = (iso) => iso ? d(iso).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}) : "—";

const ZONES = ["Chicago","North Side","West Loop","Evanston"];
const STAGES = ["Visited","Developing","Mature"];
const TIERS = ["Tier 1 – Passive Placement","Tier 2 – Active Referral","Tier 3 – Co-Marketing",
  "Tier 4 – Embedded/System","Tier 5 – Reciprocal/Cross-Promo","Tier 6 – Digital/Online"];
const ROLES = ["Property Manager","Realtor","Storage Facility Manager","Leasing Agent",
  "Front Desk","Owner","Office Manager","Concierge"];

/* ---- partnerships ---------------------------------------------------- */
const NAMES = [
  ["Lakeview Property Group","Apartment Building","North Side"],["Gold Coast Realty","Realty Office","Chicago"],
  ["StoreRight Self Storage","Storage Facility","West Loop"],["Wicker Park Lofts","Apartment Building","Chicago"],
  ["Elmwood Realty Partners","Realty Office","Evanston"],["CubeSmart Logan Sq","Storage Facility","North Side"],
  ["The Hudson Apartments","Apartment Building","West Loop"],["Dearborn Dwellings","Apartment Building","Chicago"],
  ["Northshore Realty Co","Realty Office","Evanston"],["Public Storage Clybourn","Storage Facility","North Side"],
  ["Bucktown Brew House","Coffee Shop","Chicago"],["Ace Hardware Lincoln","Hardware Store","North Side"],
  ["SpinCycle Laundromat","Laundromat","West Loop"],["Hatch Co-working","Co-working","Chicago"],
  ["IronPeak Gym","Gym","North Side"],["Milwaukee Ave Lofts","Apartment Building","Chicago"],
  ["Prairie State Realty","Realty Office","Chicago"],["SecureSpace Storage","Storage Facility","Evanston"],
  ["The Belmont Residences","Apartment Building","North Side"],["Oak & Ash Realty","Realty Office","West Loop"],
  ["Fulton Market Flats","Apartment Building","West Loop"],["Devon Storage Depot","Storage Facility","Chicago"],
  ["Rogers Park Realty","Realty Office","North Side"],["Halsted Hardware","Hardware Store","Chicago"],
  ["Uptown Suites","Apartment Building","North Side"],["Clark St Coffee","Coffee Shop","Chicago"],
  ["Evanston Commons","Apartment Building","Evanston"],["WestEnd Storage","Storage Facility","West Loop"],
  ["Lincoln Sq Realty","Realty Office","North Side"],["Grand Ave Gym","Gym","West Loop"],
];
const FIRST=["Marcus","Dana","Priya","Tom","Alicia","Jerome","Nina","Rob","Sofia","Ken",
  "Val","Darnell","Imani","Greg","Rosa","Luis","Tess","Omar","Jade","Pete"];
const LAST=["Reyes","Whitfield","Shah","Novak","Brennan","Pike","Alvarez","Keller","Mendez","Tran",
  "Osei","Boyd","Clark","Hoff","Salas","Ibrahim","Nolan","Farr","Diaz","Quinn"];

const partnerships = NAMES.map((n,i)=>{
  const stage = i<6?"Mature":i<16?"Developing":"Visited";
  // A deliberately uneven spread: some overdue, some due today, and some with
  // nothing scheduled at all. That last group is the point of the redesign.
  const lastContact = [null,shift(TODAY,-2),shift(TODAY,-9),shift(TODAY,-21),shift(TODAY,-45),shift(TODAY,-5)][i%6];
  const followUp = (i%7===0) ? null
    : (i%4===0) ? shift(TODAY,-(1+i%9))
    : (i%4===1) ? TODAY
    : shift(TODAY, 2+(i%14));
  const isSafc = i%10!==7 && i<24;
  return {
    id:"p"+i, name:n[0], biz_type:n[1], zone:n[2], stage,
    tier: TIERS[i%6],
    address: `${1200+i*7} N ${["Clark","Halsted","Ashland","Damen","Western"][i%5]} St`,
    last_contact: lastContact,
    follow_up_at: followUp,
    follow_up_time: ["9:00 AM","10:30 AM","1:00 PM","3:30 PM"][i%4],
    follow_up_note: followUp ? ["Ask about Q1 referral push","Restock + check with front desk",
      "Follow up on signed agreement","Drop new fliers","Confirm new PM contact"][i%5] : null,
    referrals: stage==="Mature"? 3+(i%7) : stage==="Developing"? (i%3) : 0,
    revenue: stage==="Mature"? 1200+i*180 : stage==="Developing"? i*60 : 0,
    safc: isSafc ? {
      placed_on: shift(TODAY,-(20+i*3)),
      last_restock: shift(TODAY,-(3+(i*5)%26)),
      interval_days: [7,14,14,21][i%4],
      cards_left: [4,12,25,40,8][i%5],
      location: ["Front counter","Lobby rack","Reception desk","Mailroom board","Checkout"][i%5],
    } : null,
  };
});
partnerships.forEach(p=>{
  p.safc_due = p.safc ? shift(p.safc.last_restock, p.safc.interval_days) : null;
});

/* ---- contacts: the business-card stack ------------------------------- */
const contacts = [];
partnerships.forEach((p,i)=>{
  // Roughly 50-odd people: the real stack of business cards, not one per door.
  const n = i%4===0 ? 3 : i%2===0 ? 2 : 1;
  for(let k=0;k<n;k++){
    const idx=(i*3+k)%20;
    const first=FIRST[idx], last=LAST[(idx+k*5)%20];
    contacts.push({
      id:`c${i}_${k}`, partnership_id:p.id, partnership:p.name,
      name:`${first} ${last}`,
      role: p.biz_type==="Realty Office" ? (k?"Leasing Agent":"Realtor")
          : p.biz_type==="Storage Facility" ? "Storage Facility Manager"
          : p.biz_type==="Apartment Building" ? (k?"Front Desk":"Property Manager")
          : ["Owner","Office Manager","Front Desk"][(i+k)%3],
      email:`${first.toLowerCase()}.${last.toLowerCase()}@${p.name.toLowerCase().replace(/[^a-z]/g,"").slice(0,12)}.com`,
      phone:`(${["312","773","847","630"][i%4]}) ${200+i*7}-${String(1000+i*37).slice(0,4)}`,
      zone:p.zone, source: i%3===0?"Business card":"Entered manually",
      added: shift(TODAY,-(5+i*2)), emailed: i%5===0 ? shift(TODAY,-(10+i)) : null,
    });
  }
});

/* ---- activity log ---------------------------------------------------- */
const LOG_KINDS=["call","visit","restock","email"];
const logs = {};
partnerships.forEach((p,i)=>{
  const out=[];
  for(let k=0;k<3+(i%4);k++){
    const kind=LOG_KINDS[(i+k)%4];
    out.push({ date: shift(TODAY,-(2+k*9+(i%5))), kind,
      outcome: kind==="call" ? ["Spoke with POC","Left voicemail","No answer","Asked to call back"][(i+k)%4]
             : kind==="visit"? ["Dropped 25 cards","Met the manager","Front desk only","Placed rack"][(i+k)%4]
             : kind==="restock"? ["Refilled to 50","Topped up 20","Rack was empty"][(i+k)%3]
             : ["Sent intro email","Sent Q4 flier","Replied to inquiry"][(i+k)%3],
      note: k===0 ? "Wants a call before the holidays. Prefers mornings." : "" });
  }
  logs[p.id]=out;
});

/* ---- jobs ------------------------------------------------------------ */
const CUST=["Gavin M.","Mark T.","Chris D.","Loreal B.","Duncan R.","Rohit P.","Alma S.","Dee W."];
const SVC=["Moving","Cleaning","Junk Removal","Handyman","Need-A-Guy","Yard Work"];
const SRC=["Google Business Profile","Facebook","Partnership Referral","F2F","Craigslist","Repeat Customer"];
const STATUS=["Inquiry","Quoted","Booked","Completed"];
const jobs = Array.from({length:22},(_,i)=>({
  id:"j"+i, job_id:`JOB-${String(46+i*3).padStart(4,"0")}`,
  customer:CUST[i%8], phone:`(312) ${400+i*11}-${String(2000+i*53).slice(0,4)}`,
  arrival: i%6===5? null : shift(TODAY, (i%9)-3),
  arrival_time:["8:00 AM","9:30 AM","1:00 PM","4:00 PM"][i%4],
  follow_up: i%3===0 ? shift(TODAY,(i%5)-2) : null,
  follow_up_time:["9:00 AM","11:00 AM","2:00 PM"][i%3],
  service:SVC[i%6], source:SRC[i%6], status:STATUS[i%4],
  workers: i%4===3? "Harrison Ratcliff" : i%4===1? "Miracle Cleaning LLC" : "—",
  invoice: i%4===3? 120+i*35 : 5.5, commission: i%4===3? 9+i*2.4 : (i%7===0?-5:0.36),
  created: shift(TODAY,-(i*2+1)),
}));

const roster = [
  {name:"Harrison Ratcliff",type:"Individual",zone:"Chicago",status:"Active",jobs:14,earned:3820,avail:1},
  {name:"Miracle Cleaning LLC",type:"Crew",zone:"North Side",status:"Active",jobs:9,earned:2640,avail:0},
  {name:"Two Guys Hauling",type:"Crew",zone:"West Loop",status:"Active",jobs:6,earned:1890,avail:8},
  {name:"Dion Carter",type:"Individual",zone:"Chicago",status:"Active",jobs:4,earned:960,avail:2},
  {name:"Evanston Yard Crew",type:"Crew",zone:"Evanston",status:"Inactive",jobs:2,earned:430,avail:22},
];

/* ---- derived helpers used across screens ----------------------------- */
const SAFC_TARGET = 100;
const safcAll = () => partnerships.filter(p=>p.safc);
const safcDueState = (p) => {
  if(!p.safc_due) return "none";
  const n = days(TODAY, p.safc_due);
  if(n < 0) return "overdue";
  if(n === 0) return "today";
  return "upcoming";
};
const followState = (p) => {
  if(!p.follow_up_at) return "none";
  const n = days(TODAY, p.follow_up_at);
  if(n < 0) return "overdue";
  if(n === 0) return "today";
  return "upcoming";
};
const relDue = (iso) => {
  if(!iso) return "not set";
  const n = days(TODAY, iso);
  if(n < 0) return `${Math.abs(n)}d overdue`;
  if(n === 0) return "today";
  if(n === 1) return "tomorrow";
  return `in ${n}d`;
};
