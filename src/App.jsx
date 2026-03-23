import { useState, useRef, useEffect } from "react";

const ACTIVITY = {
  "Stillesiddende": 1.2, "Let aktiv": 1.375,
  "Moderat aktiv": 1.55, "Meget aktiv": 1.725,
};
const CYCLING_MET = { "Let": 6, "Moderat": 10, "Hård": 14, "Meget hård": 16 };
const DEFICIT_PER_KG = 7700;
const DEFAULT_ACTIVITY = "Let aktiv";
const DEFAULT_PACE = 0.5;

const todayKey = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => new Date(d).toLocaleDateString("da-DK", { day: "numeric", month: "short" });

function calcBMR(w, h, a) { return 10 * w + 6.25 * h - 5 * a + 5; }
function calcTDEE(w, h, a, act) { return Math.round(calcBMR(w, h, a) * (ACTIVITY[act] || 1.375)); }
function calcGoalCals(tdee, pace) { return Math.round(tdee - (pace * DEFICIT_PER_KG / 7)); }
function weeksToGoal(cur, target, pace) {
  if (!target || cur <= target) return null;
  return Math.ceil((cur - target) / pace);
}
function estimatedDate(weeks) {
  if (!weeks) return null;
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}
function calcExCals(weight, minutes, intensity) {
  return Math.round((CYCLING_MET[intensity] || 10) * weight * (minutes / 60));
}

const load = (key, fb) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

const Input = ({ label, value, onChange, unit, type = "number", min, max, step }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", color: "#8a9ba8", textTransform: "uppercase", marginBottom: 6, fontFamily: "system-ui" }}>{label}</label>
    <div style={{ display: "flex", alignItems: "center", background: "#0d1117", border: "1px solid #21262d", borderRadius: 10, overflow: "hidden" }}>
      <input type={type} value={value} onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || "" : e.target.value)}
        min={min} max={max} step={step}
        style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e6edf3", fontSize: 16, padding: "12px 14px", fontFamily: "system-ui" }} />
      {unit && <span style={{ padding: "0 14px", color: "#8a9ba8", fontSize: 13, fontFamily: "system-ui" }}>{unit}</span>}
    </div>
  </div>
);

const Pill = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: "7px 14px", borderRadius: 20, border: `1px solid ${active ? "#58a6ff" : "#21262d"}`,
    background: active ? "#1f3a5f" : "transparent", color: active ? "#58a6ff" : "#8a9ba8",
    cursor: "pointer", fontSize: 13, fontFamily: "system-ui", transition: "all 0.2s"
  }}>{label}</button>
);

export default function App() {
  const [screen, setScreen] = useState(() => load("bjorn_setup_done", false) ? "main" : "onboard");
  const [profile, setProfile] = useState(() => load("bjorn_profile", { age: 35, weight: 90, height: 180, targetWeight: 80, activity: DEFAULT_ACTIVITY, pace: DEFAULT_PACE }));
  const [onboard, setOnboard] = useState({ age: "", weight: "", height: "", targetWeight: "", activity: DEFAULT_ACTIVITY, pace: DEFAULT_PACE });
  const [tab, setTab] = useState("today");
  const [entries, setEntries] = useState(() => load("bjorn_entries_" + todayKey(), []));
  const [weights, setWeights] = useState(() => load("bjorn_weights", []));
  const [water, setWater] = useState(() => load("bjorn_water_" + todayKey(), 0));
  const [exercise, setExercise] = useState(() => load("bjorn_exercise_" + todayKey(), []));
  const [savedMeals, setSavedMeals] = useState(() => load("bjorn_saved_meals", []));
  const [analyzing, setAnalyzing] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [correction, setCorrection] = useState("");
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [editProfile, setEditProfile] = useState(false);
  const [showExercise, setShowExercise] = useState(false);
  const [exMinutes, setExMinutes] = useState("");
  const [exIntensity, setExIntensity] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const fileRef = useRef();
  const cameraRef = useRef();

  const tdee = calcTDEE(profile.weight, profile.height, profile.age, profile.activity);
  const goalCals = calcGoalCals(tdee, profile.pace);
  const deficit = tdee - goalCals;
  const totalCals = entries.reduce((s, e) => s + e.calories, 0);
  const totalExCals = exercise.reduce((s, e) => s + e.calories, 0);
  const remaining = goalCals + totalExCals - totalCals;
  const progress = Math.min((totalCals / (goalCals + totalExCals || 1)) * 100, 100);
  const weeks = weeksToGoal(profile.weight, profile.targetWeight, profile.pace);
  const arrival = estimatedDate(weeks);
  const totalProtein = entries.reduce((s, e) => s + (e.protein || 0), 0);
  const totalCarbs = entries.reduce((s, e) => s + (e.carbs || 0), 0);
  const totalFat = entries.reduce((s, e) => s + (e.fat || 0), 0);

  useEffect(() => { save("bjorn_entries_" + todayKey(), entries); }, [entries]);
  useEffect(() => { save("bjorn_weights", weights); }, [weights]);
  useEffect(() => { save("bjorn_water_" + todayKey(), water); }, [water]);
  useEffect(() => { save("bjorn_profile", profile); }, [profile]);
  useEffect(() => { save("bjorn_exercise_" + todayKey(), exercise); }, [exercise]);
  useEffect(() => { save("bjorn_saved_meals", savedMeals); }, [savedMeals]);

  const showToast = (msg, color = "#3fb950") => { setToast({ msg, color }); setTimeout(() => setToast(null), 2500); };

  const finishOnboard = () => {
    if (!onboard.age || !onboard.weight || !onboard.height || !onboard.targetWeight) return;
    setProfile({ ...onboard });
    save("bjorn_profile", { ...onboard });
    save("bjorn_setup_done", true);
    const w = [{ date: todayKey(), weight: parseFloat(onboard.weight) }];
    setWeights(w); save("bjorn_weights", w);
    setScreen("main");
  };

  const handleImage = (file) => {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => { setPreview(e.target.result); setImageData(e.target.result.split(",")[1]); };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!imageData) return;
    setAnalyzing(true); setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData })
      });
      const parsed = await res.json();
      if (parsed.error) throw new Error(parsed.error);
      setAnalysisResult(parsed);
      setCorrection("");
    } catch (err) { setError("Kunne ikke analysere billedet. Prøv igen."); }
    finally { setAnalyzing(false); }
  };

  const confirmEntry = (result, img) => {
    if (!result) return;
    const entry = { id: Date.now(), time: new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }), name: result.name, calories: result.calories, protein: result.protein || 0, carbs: result.carbs || 0, fat: result.fat || 0, description: result.description, image: img || null };
    setEntries(prev => [entry, ...prev]);
    setPreview(null); setImageData(null); setAnalysisResult(null); setCorrection(""); setShowSaveModal(false);
    showToast(`${entry.name} — ${entry.calories} kcal tilføjet`);
    setTab("today");
  };

  const applyCorrection = async () => {
    if (!correction.trim() || !analysisResult) return;
    setCorrecting(true); setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData,
          prompt: "Tidligere analyse: " + JSON.stringify(analysisResult) + "\n\nRettelse: \"" + correction + "\"\n\nReturner KUN opdateret JSON uden markdown:\n{\"name\":\"navn\",\"calories\":0,\"protein\":0,\"carbs\":0,\"fat\":0,\"description\":\"1 saetning\",\"confidence\":\"hoej/medium/lav\"}"
        })
      });
      const parsed = await res.json();
      if (parsed.error) throw new Error(parsed.error);
      setAnalysisResult(parsed);
      setCorrection("");
      showToast("Analyse opdateret ✓");
    } catch { setError("Kunne ikke opdatere. Prøv igen."); }
    finally { setCorrecting(false); }
  };

  const saveMeal = () => {
    if (!saveName.trim() || !analysisResult) return;
    const meal = { id: Date.now(), name: saveName.trim(), calories: analysisResult.calories, protein: analysisResult.protein || 0, carbs: analysisResult.carbs || 0, fat: analysisResult.fat || 0 };
    setSavedMeals(prev => [meal, ...prev]);
    setSaveName(""); setShowSaveModal(false);
    showToast(`"${meal.name}" gemt som favorit ⭐`);
  };

  const logSavedMeal = (meal) => {
    const entry = { id: Date.now(), time: new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }), name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, image: null };
    setEntries(prev => [entry, ...prev]);
    setShowSavedMeals(false);
    showToast(`${meal.name} — ${meal.calories} kcal tilføjet`);
  };

  const logExercise = () => {
    const cals = parseInt(exMinutes) || 0;
    const duration = exIntensity ? `${exIntensity} min` : "";
    setExercise(prev => [{ id: Date.now(), time: new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }), intensity: duration, calories: cals }, ...prev]);
    setShowExercise(false);
    setExMinutes(""); setExIntensity("");
    showToast(`🚴 Zwift — ${cals} kcal forbrændt`);
  };

  const logWeight = () => {
    const w = parseFloat(newWeight);
    if (!w) return;
    const today = todayKey();
    const updated = [...weights.filter(x => x.date !== today), { date: today, weight: w }].sort((a, b) => a.date.localeCompare(b.date));
    setWeights(updated); setProfile(p => ({ ...p, weight: w }));
    setNewWeight(""); setShowWeightInput(false);
    showToast(`Vægt opdateret: ${w} kg`);
  };

  const progressBar = (val, max, color) => (
    <div style={{ background: "#161b22", borderRadius: 4, height: 6, overflow: "hidden" }}>
      <div style={{ width: `${Math.min((val / max) * 100, 100)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
    </div>
  );

  if (screen === "onboard") return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "'Georgia', serif", maxWidth: 480, margin: "0 auto", padding: "40px 24px 60px" }}>
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 11, letterSpacing: "0.2em", color: "#58a6ff", textTransform: "uppercase", margin: "0 0 8px", fontFamily: "system-ui" }}>Velkommen, Bjørn</p>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 400, letterSpacing: "-0.02em" }}>Lad os komme i gang</h1>
        <p style={{ margin: 0, fontSize: 14, color: "#8a9ba8", fontFamily: "system-ui", lineHeight: 1.6 }}>Jeg beregner dit personlige kaloriemål.</p>
      </div>
      <Input label="Alder" value={onboard.age} onChange={v => setOnboard(o => ({ ...o, age: v }))} unit="år" min={15} max={90} />
      <Input label="Nuværende vægt" value={onboard.weight} onChange={v => setOnboard(o => ({ ...o, weight: v }))} unit="kg" step={0.1} />
      <Input label="Højde" value={onboard.height} onChange={v => setOnboard(o => ({ ...o, height: v }))} unit="cm" />
      <Input label="Målvægt" value={onboard.targetWeight} onChange={v => setOnboard(o => ({ ...o, targetWeight: v }))} unit="kg" step={0.1} />
      {onboard.weight && onboard.height && onboard.age && onboard.targetWeight && (() => {
        const t = calcTDEE(+onboard.weight, +onboard.height, +onboard.age, onboard.activity);
        const g = calcGoalCals(t, onboard.pace);
        const wks = weeksToGoal(+onboard.weight, +onboard.targetWeight, onboard.pace);
        return (
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 14, padding: 20, margin: "24px 0", fontFamily: "system-ui" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, letterSpacing: "0.1em", color: "#8a9ba8", textTransform: "uppercase" }}>Dit personlige mål</p>
            {[["Vedligeholdelse (TDEE)", `${t} kcal`, "#e6edf3"], ["Dagligt underskud", `-${t - g} kcal`, "#f85149"], ["Dit daglige mål", `${g} kcal`, "#58a6ff"]].map(([lbl, val, col]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#8a9ba8", fontSize: 14 }}>{lbl}</span>
                <span style={{ fontWeight: 600, color: col }}>{val}</span>
              </div>
            ))}
            {wks && <div style={{ background: "#0d1117", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#3fb950", marginTop: 8 }}>
              🎯 Du når {onboard.targetWeight} kg om ca. <strong>{wks} uger</strong> — {estimatedDate(wks)}
            </div>}
          </div>
        );
      })()}
      <button onClick={finishOnboard} disabled={!onboard.age || !onboard.weight || !onboard.height || !onboard.targetWeight}
        style={{ width: "100%", padding: "16px", background: (!onboard.age || !onboard.weight || !onboard.height || !onboard.targetWeight) ? "#21262d" : "#1f6feb", color: "#e6edf3", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui" }}>
        Start min rejse →
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "'Georgia', serif", maxWidth: 480, margin: "0 auto", position: "relative" }}>
      {toast && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#161b22", border: `1px solid ${toast.color}44`, borderRadius: 10, padding: "10px 18px", fontSize: 14, color: toast.color, fontFamily: "system-ui", zIndex: 999, whiteSpace: "nowrap", boxShadow: "0 4px 24px #00000088", animation: "fadeDown 0.3s ease" }}>{toast.msg}</div>}

      <div style={{ padding: "28px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: 11, letterSpacing: "0.15em", color: "#58a6ff", textTransform: "uppercase", fontFamily: "system-ui" }}>{new Date().toLocaleDateString("da-DK", { weekday: "long" })}</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em" }}>Min Dagbog</h1>
        </div>
        <button onClick={() => setEditProfile(p => !p)} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 10, padding: "8px 14px", color: "#8a9ba8", fontSize: 13, cursor: "pointer", fontFamily: "system-ui" }}>⚙ Profil</button>
      </div>

      {editProfile && (
        <div style={{ margin: "16px 20px 0", background: "#161b22", border: "1px solid #21262d", borderRadius: 16, padding: 20 }}>
          <p style={{ margin: "0 0 16px", fontSize: 12, letterSpacing: "0.1em", color: "#8a9ba8", textTransform: "uppercase", fontFamily: "system-ui" }}>Rediger profil</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Alder", "age", "år"], ["Højde", "height", "cm"], ["Nuv. vægt", "weight", "kg"], ["Målvægt", "targetWeight", "kg"]].map(([lbl, key, unit]) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: "#8a9ba8", fontFamily: "system-ui", display: "block", marginBottom: 4 }}>{lbl}</label>
                <div style={{ display: "flex", background: "#0d1117", border: "1px solid #21262d", borderRadius: 8 }}>
                  <input type="number" value={profile[key]} step={0.1} onChange={e => setProfile(p => ({ ...p, [key]: parseFloat(e.target.value) || p[key] }))}
                    style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e6edf3", fontSize: 15, padding: "8px 10px", fontFamily: "system-ui" }} />
                  <span style={{ padding: "0 8px", color: "#8a9ba8", fontSize: 12, fontFamily: "system-ui", alignSelf: "center" }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, color: "#8a9ba8", fontFamily: "system-ui", display: "block", marginBottom: 6 }}>Tempo</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[0.25, 0.5, 0.75, 1.0].map(p => <Pill key={p} label={`${p} kg/uge`} active={profile.pace === p} onClick={() => setProfile(pr => ({ ...pr, pace: p }))} />)}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, color: "#8a9ba8", fontFamily: "system-ui", display: "block", marginBottom: 6 }}>Aktivitetsniveau</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.keys(ACTIVITY).map(a => <Pill key={a} label={a} active={profile.activity === a} onClick={() => setProfile(p => ({ ...p, activity: a }))} />)}
            </div>
          </div>
          <button onClick={() => setEditProfile(false)} style={{ marginTop: 16, width: "100%", background: "#1f6feb", border: "none", borderRadius: 10, padding: "10px", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "system-ui" }}>Gem ændringer</button>
        </div>
      )}

      <div style={{ display: "flex", margin: "20px 20px 0", background: "#161b22", borderRadius: 12, padding: 4, gap: 2 }}>
        {[["today", "I dag"], ["progress", "Fremgang"], ["camera", "📷 Tilføj"]].map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "9px 6px", borderRadius: 9, border: "none", background: tab === t ? "#21262d" : "transparent", color: tab === t ? "#e6edf3" : "#8a9ba8", cursor: "pointer", fontSize: 13, fontFamily: "system-ui", fontWeight: tab === t ? 600 : 400, transition: "all 0.2s" }}>{lbl}</button>
        ))}
      </div>

      <div style={{ padding: "16px 20px 100px" }}>
        {tab === "today" && (
          <div>
            <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 18, padding: 20, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#8a9ba8", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "system-ui", marginBottom: 4 }}>Spist i dag</div>
                  <div style={{ fontSize: 40, fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1 }}>{totalCals} <span style={{ fontSize: 16, color: "#8a9ba8", fontWeight: 400 }}>kcal</span></div>
                </div>
                <div style={{ textAlign: "right", fontFamily: "system-ui" }}>
                  <div style={{ fontSize: 11, color: "#8a9ba8", marginBottom: 2 }}>Mål: {goalCals}{totalExCals > 0 ? ` +${totalExCals}🚴` : ""}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: remaining >= 0 ? "#3fb950" : "#f85149" }}>{remaining >= 0 ? `-${remaining}` : `+${Math.abs(remaining)}`}</div>
                  <div style={{ fontSize: 11, color: "#8a9ba8" }}>{remaining >= 0 ? "tilbage" : "over mål"}</div>
                </div>
              </div>
              <div style={{ background: "#0d1117", borderRadius: 8, height: 10, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ width: `${progress}%`, height: "100%", borderRadius: 8, transition: "width 0.6s ease", background: progress > 95 ? "#f85149" : progress > 75 ? "#d29922" : "#1f6feb" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontFamily: "system-ui" }}>
                {[["Protein", totalProtein, "#58a6ff", 160], ["Kulhy.", totalCarbs, "#d29922", 200], ["Fedt", totalFat, "#3fb950", 70]].map(([lbl, val, col, rec]) => (
                  <div key={lbl} style={{ background: "#0d1117", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: col }}>{Math.round(val)}g</div>
                    <div style={{ fontSize: 11, color: "#8a9ba8", marginBottom: 6 }}>{lbl}</div>
                    {progressBar(val, rec, col)}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 14, padding: 16, marginBottom: 12, fontFamily: "system-ui" }}>
              {[["Din TDEE (vedligeholdelse)", `${tdee} kcal`, "#e6edf3"], ["Dagligt underskud", `-${deficit} kcal`, "#f85149"], ["Estimeret fedttab/uge", `ca. ${profile.pace} kg`, "#3fb950"]].map(([lbl, val, col]) => (
                <div key={lbl} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: "#8a9ba8" }}>{lbl}</span><span style={{ color: col }}>{val}</span>
                </div>
              ))}
              {arrival && <div style={{ marginTop: 8, background: "#0d1117", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#58a6ff" }}>🎯 Mål nås ca. <strong>{arrival}</strong></div>}
            </div>

            <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontFamily: "system-ui", fontSize: 14 }}>💧 Vand</span>
                <span style={{ fontFamily: "system-ui", fontSize: 16, fontWeight: 700, color: "#58a6ff" }}>{water} / 8 glas</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <button key={i} onClick={() => setWater(w => i < w ? i : i + 1)} style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: i < water ? "#1f4f8f" : "#0d1117", cursor: "pointer", transition: "background 0.2s" }} />
                ))}
              </div>
            </div>

            <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "system-ui", fontSize: 14 }}>🚴 Zwift</span>
                  {totalExCals > 0 && <span style={{ fontFamily: "system-ui", fontSize: 13, color: "#3fb950", fontWeight: 600 }}>+{totalExCals} kcal</span>}
                </div>
                <button onClick={() => setShowExercise(v => !v)} style={{ background: "#1f6feb", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "system-ui" }}>+ Log tur</button>
              </div>
              {showExercise && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: "#8a9ba8", fontFamily: "system-ui", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Kalorier fra Zwift</div>
                  <p style={{ margin: "0 0 10px", fontFamily: "system-ui", fontSize: 13, color: "#8a9ba8", lineHeight: 1.5 }}>Find kalorietallet i Zwift-appen og tast det ind her.</p>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <input type="number" value={exMinutes} onChange={e => setExMinutes(e.target.value)} placeholder="fx 650"
                      style={{ flex: 1, background: "#0d1117", border: "1px solid #21262d", borderRadius: 10, padding: "12px 14px", color: "#e6edf3", fontSize: 16, fontFamily: "system-ui", outline: "none" }} />
                    <span style={{ alignSelf: "center", color: "#8a9ba8", fontFamily: "system-ui" }}>kcal</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#8a9ba8", fontFamily: "system-ui", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Varighed (valgfrit)</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {[30, 45, 60, 90, 120].map(m => (
                      <button key={m} onClick={() => setExIntensity(String(m))} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${exIntensity === String(m) ? "#58a6ff" : "#21262d"}`, background: exIntensity === String(m) ? "#1f3a5f" : "#0d1117", color: exIntensity === String(m) ? "#58a6ff" : "#8a9ba8", cursor: "pointer", fontSize: 12, fontFamily: "system-ui" }}>{m}m</button>
                    ))}
                  </div>
                  <button onClick={logExercise} disabled={!exMinutes} style={{ width: "100%", background: exMinutes ? "#238636" : "#21262d", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 15, fontWeight: 600, cursor: exMinutes ? "pointer" : "not-allowed", fontFamily: "system-ui" }}>✓ Log Zwift-tur</button>
                </div>
              )}
              {exercise.length > 0 && !showExercise && (
                <div style={{ marginTop: 10 }}>
                  {exercise.map(e => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "system-ui", fontSize: 13, padding: "6px 0", borderTop: "1px solid #21262d" }}>
                      <span style={{ color: "#8a9ba8" }}>{e.time}{e.intensity ? ` · ${e.intensity} min` : ""}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#3fb950", fontWeight: 600 }}>+{e.calories} kcal</span>
                        <button onClick={() => setExercise(prev => prev.filter(x => x.id !== e.id))} style={{ background: "none", border: "none", color: "#8a9ba8", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {savedMeals.length > 0 && (
              <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 14, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontFamily: "system-ui", fontSize: 14 }}>⭐ Gemte måltider</span>
                  <button onClick={() => setShowSavedMeals(v => !v)} style={{ background: "none", border: "none", color: "#58a6ff", fontSize: 13, cursor: "pointer", fontFamily: "system-ui" }}>{showSavedMeals ? "Skjul" : "Vis alle"}</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(showSavedMeals ? savedMeals : savedMeals.slice(0, 3)).map(meal => (
                    <div key={meal.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1117", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ fontFamily: "system-ui" }}>
                        <div style={{ fontSize: 14, marginBottom: 2 }}>{meal.name}</div>
                        <div style={{ fontSize: 11, color: "#8a9ba8" }}>{meal.calories} kcal · P{meal.protein}g · K{meal.carbs}g · F{meal.fat}g</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => logSavedMeal(meal)} style={{ background: "#238636", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "system-ui", fontWeight: 600 }}>+ Log</button>
                        <button onClick={() => setSavedMeals(prev => prev.filter(m => m.id !== meal.id))} style={{ background: "none", border: "none", color: "#8a9ba8", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "system-ui", fontSize: 13, color: "#8a9ba8" }}>Dagens måltider ({entries.length})</span>
              {entries.length > 0 && <button onClick={() => setEntries([])} style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer", fontSize: 12, fontFamily: "system-ui" }}>Ryd alle</button>}
            </div>
            {entries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#8a9ba8", fontFamily: "system-ui" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🍽</div>
                <div>Ingen måltider endnu — tag et billede!</div>
              </div>
            ) : entries.map(e => (
              <div key={e.id} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 14, overflow: "hidden", display: "flex", marginBottom: 8 }}>
                {e.image && <img src={e.image} alt="" style={{ width: 72, height: 72, objectFit: "cover", flexShrink: 0 }} />}
                <div style={{ flex: 1, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 15 }}>{e.name}</span>
                    <span style={{ fontFamily: "system-ui", fontWeight: 700, color: "#58a6ff" }}>{e.calories}</span>
                  </div>
                  <div style={{ fontFamily: "system-ui", fontSize: 12, color: "#8a9ba8", display: "flex", gap: 10 }}>
                    <span>{e.time}</span><span>P {e.protein}g</span><span>K {e.carbs}g</span><span>F {e.fat}g</span>
                    <button onClick={() => setEntries(prev => prev.filter(x => x.id !== e.id))} style={{ marginLeft: "auto", background: "none", border: "none", color: "#8a9ba8", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "progress" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: "system-ui", fontSize: 14, color: "#8a9ba8" }}>Vægt-historik</span>
              <button onClick={() => setShowWeightInput(v => !v)} style={{ background: "#1f6feb", border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "system-ui" }}>+ Log vægt</button>
            </div>
            {showWeightInput && (
              <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 16, marginBottom: 12, display: "flex", gap: 10 }}>
                <input type="number" placeholder="fx 88.5" step={0.1} value={newWeight} onChange={e => setNewWeight(e.target.value)}
                  style={{ flex: 1, background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", color: "#e6edf3", fontSize: 16, fontFamily: "system-ui", outline: "none" }} />
                <span style={{ alignSelf: "center", color: "#8a9ba8", fontFamily: "system-ui" }}>kg</span>
                <button onClick={logWeight} style={{ background: "#1f6feb", border: "none", borderRadius: 8, padding: "10px 16px", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "system-ui" }}>Gem</button>
              </div>
            )}
            {weights.length > 1 ? (
              <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 16, padding: 20, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#8a9ba8", fontFamily: "system-ui", marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Vægtudvikling</div>
                {(() => {
                  const vals = weights.map(w => w.weight);
                  const minV = Math.min(...vals) - 1, maxV = Math.max(...vals) + 1, range = maxV - minV;
                  const W = 320, H = 120;
                  const pts = weights.map((w, i) => ({ x: (i / Math.max(weights.length - 1, 1)) * (W - 40) + 20, y: H - ((w.weight - minV) / range) * (H - 20) - 10 }));
                  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
                  return (
                    <div style={{ overflowX: "auto" }}>
                      <svg width={W} height={H + 20} style={{ display: "block" }}>
                        <path d={path} fill="none" stroke="#1f6feb" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        {pts.map((p, i) => (
                          <g key={i}>
                            <circle cx={p.x} cy={p.y} r={4} fill="#1f6feb" />
                            <text x={p.x} y={H + 15} textAnchor="middle" fontSize={9} fill="#8a9ba8" fontFamily="system-ui">{fmtDate(weights[i].date)}</text>
                            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={10} fill="#e6edf3" fontFamily="system-ui">{weights[i].weight}</text>
                          </g>
                        ))}
                        {profile.targetWeight >= minV && profile.targetWeight <= maxV && (
                          <line x1={20} x2={W - 20} y1={H - ((profile.targetWeight - minV) / range) * (H - 20) - 10} y2={H - ((profile.targetWeight - minV) / range) * (H - 20) - 10} stroke="#3fb950" strokeWidth={1} strokeDasharray="4 3" />
                        )}
                      </svg>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "system-ui", fontSize: 13 }}>
                  <span style={{ color: "#8a9ba8" }}>Start: <strong style={{ color: "#e6edf3" }}>{weights[0]?.weight} kg</strong></span>
                  <span style={{ color: "#8a9ba8" }}>Nu: <strong style={{ color: "#e6edf3" }}>{weights[weights.length - 1]?.weight} kg</strong></span>
                  <span style={{ color: "#8a9ba8" }}>Mål: <strong style={{ color: "#3fb950" }}>{profile.targetWeight} kg</strong></span>
                </div>
              </div>
            ) : (
              <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 16, padding: 24, textAlign: "center", color: "#8a9ba8", fontFamily: "system-ui", marginBottom: 12 }}>Log din vægt dagligt for at se din fremgang</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["Startsvægt", `${weights[0]?.weight ?? "—"} kg`, "#8a9ba8"], ["Nuv. vægt", `${weights[weights.length - 1]?.weight ?? profile.weight} kg`, "#e6edf3"], ["Målvægt", `${profile.targetWeight} kg`, "#3fb950"], ["Tilbage", `${Math.max(0, (weights[weights.length - 1]?.weight || profile.weight) - profile.targetWeight).toFixed(1)} kg`, "#58a6ff"], ["Kaloriemål/dag", `${goalCals} kcal`, "#58a6ff"], ["Ugentligt tab", `${profile.pace} kg`, "#3fb950"]].map(([lbl, val, col]) => (
                <div key={lbl} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "14px 16px", fontFamily: "system-ui" }}>
                  <div style={{ fontSize: 11, color: "#8a9ba8", marginBottom: 4 }}>{lbl}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: col }}>{val}</div>
                </div>
              ))}
            </div>
            {arrival && (
              <div style={{ background: "#0d2818", border: "1px solid #3fb95044", borderRadius: 14, padding: 16, marginTop: 12, fontFamily: "system-ui", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>🎯</div>
                <div style={{ fontSize: 14, color: "#3fb950", fontWeight: 600 }}>Estimeret mål-dato</div>
                <div style={{ fontSize: 20, marginTop: 4 }}>{arrival}</div>
                <div style={{ fontSize: 13, color: "#8a9ba8", marginTop: 4 }}>om ca. {weeks} uger ved {profile.pace} kg/uge</div>
              </div>
            )}
          </div>
        )}

        {tab === "camera" && (
          <div>
            {!preview && (
              <div>
                <p style={{ fontFamily: "system-ui", fontSize: 14, color: "#8a9ba8", margin: "0 0 20px", lineHeight: 1.6 }}>Tag et billede af din mad, og jeg analyserer kalorieindhold og makronæringsstoffer.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <button onClick={() => cameraRef.current.click()} style={{ background: "#1f6feb", color: "#fff", border: "none", borderRadius: 14, padding: "18px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui" }}>📷 Kamera</button>
                  <button onClick={() => fileRef.current.click()} style={{ background: "#161b22", color: "#e6edf3", border: "1px solid #21262d", borderRadius: 14, padding: "18px", fontSize: 16, cursor: "pointer", fontFamily: "system-ui" }}>🖼 Vælg billede</button>
                </div>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleImage(e.target.files[0])} />
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImage(e.target.files[0])} />
              </div>
            )}
            {preview && !analysisResult && (
              <div>
                <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #21262d", marginBottom: 14, position: "relative" }}>
                  <img src={preview} alt="Mad" style={{ width: "100%", display: "block", maxHeight: 300, objectFit: "cover" }} />
                  {analyzing && (
                    <div style={{ position: "absolute", inset: 0, background: "#0d1117cc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, border: "3px solid #21262d", borderTop: "3px solid #58a6ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      <span style={{ color: "#58a6ff", fontFamily: "system-ui", fontSize: 14 }}>Analyserer…</span>
                    </div>
                  )}
                </div>
                {error && <div style={{ background: "#1c0f0f", border: "1px solid #f8514944", borderRadius: 10, padding: "10px 14px", marginBottom: 12, color: "#f85149", fontFamily: "system-ui", fontSize: 13 }}>{error}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setPreview(null); setImageData(null); setError(null); }} style={{ flex: 1, background: "#161b22", color: "#8a9ba8", border: "1px solid #21262d", borderRadius: 12, padding: "14px", fontSize: 15, cursor: "pointer", fontFamily: "system-ui" }}>Fortryd</button>
                  <button onClick={analyzeImage} disabled={analyzing} style={{ flex: 2, background: analyzing ? "#21262d" : "#1f6feb", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, cursor: analyzing ? "not-allowed" : "pointer", fontFamily: "system-ui" }}>{analyzing ? "Analyserer…" : "✨ Analyser"}</button>
                </div>
              </div>
            )}
            {preview && analysisResult && (
              <div>
                <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #21262d", marginBottom: 14, height: 140, position: "relative" }}>
                  <img src={preview} alt="Mad" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #0d1117cc, transparent)" }} />
                  <div style={{ position: "absolute", bottom: 10, left: 14, fontFamily: "system-ui", fontSize: 13, color: "#e6edf3", fontWeight: 600 }}>{analysisResult.name}</div>
                  <div style={{ position: "absolute", top: 10, right: 12, background: "#0d1117aa", borderRadius: 8, padding: "3px 10px", fontFamily: "system-ui", fontSize: 11, color: analysisResult.confidence === "hoej" ? "#3fb950" : analysisResult.confidence === "lav" ? "#f85149" : "#d29922" }}>
                    {analysisResult.confidence === "hoej" ? "✓ Høj sikkerhed" : analysisResult.confidence === "lav" ? "⚠ Lav sikkerhed" : "~ Medium sikkerhed"}
                  </div>
                </div>
                <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>{analysisResult.name}</span>
                    <span style={{ fontFamily: "system-ui", fontSize: 28, fontWeight: 700, color: "#58a6ff" }}>{analysisResult.calories} <span style={{ fontSize: 14, color: "#8a9ba8", fontWeight: 400 }}>kcal</span></span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontFamily: "system-ui" }}>
                    {[["Protein", analysisResult.protein, "#58a6ff"], ["Kulhy.", analysisResult.carbs, "#d29922"], ["Fedt", analysisResult.fat, "#3fb950"]].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ background: "#0d1117", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: col }}>{val}g</div>
                        <div style={{ fontSize: 11, color: "#8a9ba8" }}>{lbl}</div>
                      </div>
                    ))}
                  </div>
                  {analysisResult.description && <p style={{ margin: "10px 0 0", fontFamily: "system-ui", fontSize: 13, color: "#8a9ba8", fontStyle: "italic" }}>{analysisResult.description}</p>}
                </div>
                <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontFamily: "system-ui", fontSize: 13, color: "#8a9ba8", marginBottom: 8 }}>🔧 Noget forkert? Beskriv rettelsen:</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="text" value={correction} onChange={e => setCorrection(e.target.value)} placeholder='fx "det er laks ikke tun"'
                      style={{ flex: 1, background: "#0d1117", border: "1px solid #21262d", borderRadius: 10, padding: "10px 12px", color: "#e6edf3", fontSize: 14, fontFamily: "system-ui", outline: "none" }} />
                    <button onClick={applyCorrection} disabled={!correction.trim() || correcting} style={{ background: correction.trim() && !correcting ? "#1f6feb" : "#21262d", color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 14, cursor: correction.trim() && !correcting ? "pointer" : "not-allowed", fontFamily: "system-ui", fontWeight: 600 }}>{correcting ? "…" : "Ret"}</button>
                  </div>
                  {error && <div style={{ marginTop: 8, color: "#f85149", fontFamily: "system-ui", fontSize: 13 }}>{error}</div>}
                </div>
                {showSaveModal && (
                  <div style={{ background: "#161b22", border: "1px solid #58a6ff44", borderRadius: 14, padding: 16, marginBottom: 14 }}>
                    <div style={{ fontFamily: "system-ui", fontSize: 13, color: "#8a9ba8", marginBottom: 8 }}>Gem som favorit:</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} placeholder='fx "Havregrød med bær"'
                        style={{ flex: 1, background: "#0d1117", border: "1px solid #21262d", borderRadius: 10, padding: "10px 12px", color: "#e6edf3", fontSize: 14, fontFamily: "system-ui", outline: "none" }} />
                      <button onClick={saveMeal} disabled={!saveName.trim()} style={{ background: saveName.trim() ? "#1f6feb" : "#21262d", color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 14, cursor: saveName.trim() ? "pointer" : "not-allowed", fontFamily: "system-ui", fontWeight: 600 }}>Gem</button>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setAnalysisResult(null); setPreview(null); setImageData(null); setCorrection(""); setError(null); setShowSaveModal(false); }} style={{ flex: 1, background: "#161b22", color: "#8a9ba8", border: "1px solid #21262d", borderRadius: 12, padding: "14px", fontSize: 15, cursor: "pointer", fontFamily: "system-ui" }}>✕</button>
                  <button onClick={() => setShowSaveModal(v => !v)} style={{ flex: 1, background: "#161b22", color: "#58a6ff", border: "1px solid #58a6ff44", borderRadius: 12, padding: "14px", fontSize: 15, cursor: "pointer", fontFamily: "system-ui" }}>⭐ Gem</button>
                  <button onClick={() => confirmEntry(analysisResult, preview)} style={{ flex: 2, background: "#238636", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui" }}>✓ Tilføj</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeDown { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        * { box-sizing: border-box; }
        button { transition: opacity 0.15s; }
        button:active { opacity: 0.75; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
      `}</style>
    </div>
  );
}
