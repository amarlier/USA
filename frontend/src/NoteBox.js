import React from "react";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NoteBox({ scope, dayId, title }) {
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saveState, setSaveState] = React.useState("idle"); // idle | saving | saved | error
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState("");
  const saveTimer = React.useRef(null);

  const qs = `scope=${scope}${dayId ? `&dayId=${dayId}` : ""}`;

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/notes?${qs}`)
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        setText(data.text || "");
        setFiles(data.files || []);
        setLoading(false);
      })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, dayId]);

  const scheduleSave = (value) => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, dayId, text: value }),
        });
        setSaveState("saved");
        setTimeout(() => setSaveState(s => (s === "saved" ? "idle" : s)), 1500);
      } catch {
        setSaveState("error");
      }
    }, 800);
  };

  const onChange = (e) => {
    const value = e.target.value;
    setText(value);
    scheduleSave(value);
  };

  const onFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError("");
    if (file.size > 4 * 1024 * 1024) {
      setUploadError("Fichier trop volumineux (max 4 Mo).");
      e.target.value = "";
      return;
    }
    const extMatch = file.name.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : "";
    const defaultLabel = file.name.replace(/\.[^.]+$/, "");
    const label = window.prompt(
      "Nom pour ce fichier (ex: Billet avion, Passeport Papa, Réservation hôtel)",
      /^(content|image|photo|img|file|document)$/i.test(defaultLabel) ? "" : defaultLabel
    );
    if (label === null) { e.target.value = ""; return; }
    const displayName = (label.trim() || `Fichier ${new Date().toLocaleDateString("fr-FR")}`) + ext;

    setUploading(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, dayId, filename: displayName, contentType: file.type, dataBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'envoi");
      setFiles(data.files || []);
    } catch (err) {
      setUploadError(err.message || "Échec de l'envoi");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeFile = async (pathname) => {
    try {
      const res = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, dayId, pathname }),
      });
      const data = await res.json();
      if (res.ok) setFiles(data.files || []);
    } catch {
      // ignore
    }
  };

  return (
    <div className="notebox" data-testid={`notebox-${scope}${dayId ? `-${dayId}` : ""}`}>
      <div className="notebox-header">
        <span className="notebox-title"><i className="fa-solid fa-note-sticky"></i> {title}</span>
        <span className="notebox-status">
          {saveState === "saving" && "Enregistrement…"}
          {saveState === "saved" && "✓ Enregistré"}
          {saveState === "error" && "Erreur d'enregistrement"}
        </span>
      </div>
      <textarea
        className="notebox-textarea"
        placeholder="Notes partagées avec tout le monde…"
        value={text}
        onChange={onChange}
        disabled={loading}
        rows={4}
        data-testid={`notebox-textarea-${scope}${dayId ? `-${dayId}` : ""}`}
      />
      <div className="notebox-files">
        {files.map((f, i) => (
          <div key={i} className="notebox-file">
            <a href={`/api/file?pathname=${encodeURIComponent(f.pathname)}`} target="_blank" rel="noreferrer"><i className="fa-solid fa-paperclip"></i> {f.name}</a>
            <button onClick={() => removeFile(f.pathname)} className="notebox-file-remove" aria-label="Supprimer">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
      </div>
      <label className="notebox-upload">
        <i className="fa-solid fa-paperclip"></i> {uploading ? "Envoi…" : "Joindre un fichier (billet, PDF, photo…)"}
        <input type="file" onChange={onFileChange} disabled={uploading} style={{ display: "none" }} />
      </label>
      {uploadError && <div className="notebox-error">{uploadError}</div>}
    </div>
  );
}
