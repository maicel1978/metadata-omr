/**
 * @file app.js
 * @version 7.0.0 (High Contrast Edition)
 */

'use strict';

const VarOpsApp = (() => {
    const STORAGE_KEY = 'clinical_varops_db_v7';
    const STAT_TYPES = Object.freeze(["Nominal Dicotómica", "Nominal Politómica", "Ordinal", "Cuantitativa Discreta", "Cuantitativa Continua"]);
    
    const CLINICAL_LIBRARY = Object.freeze({
        "sex": { name: "sexo", type: "Nominal Dicotómica", description: "Sexo biológico del paciente", metadata: { question: "¿Cuál es el sexo biológico?", unit: "", range: { min: "", max: "" }, categories: [{ label: "Masculino", synonyms: ["m", "1"] }, { label: "Femenino", synonyms: ["f", "2"] }] } },
        "age": { name: "edad", type: "Cuantitativa Discreta", description: "Edad cronológica en años cumplidos", metadata: { question: "¿Qué edad tiene el paciente?", unit: "años", range: { min: "0", max: "115" }, categories: [] } },
        "htn": { name: "hta", type: "Nominal Dicotómica", description: "Antecedentes de Hipertensión Arterial", metadata: { question: "¿Padece actualmente de Hipertensión?", unit: "", range: { min: "", max: "" }, categories: [{ label: "Sí", synonyms: ["s", "1"] }, { label: "No", synonyms: ["n", "0"] }] } }
    });

    let db = { project: { name: '', specialty: '', date: new Date().toISOString().split('T')[0] }, variables: [] };

    const escapeHTML = (s) => s ? s.toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : "";
    const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) {} };

    const validateVar = (v) => {
        if (!v || !v.metadata) return false;
        const isQ = v.type.includes('Cuantitativa');
        const hasName = v.name && v.name.trim().length > 0;
        const hasDesc = v.description && v.description.trim().length >= 3;
        const rangeOk = isQ ? (v.metadata.range.min !== "" && v.metadata.range.max !== "" && parseFloat(v.metadata.range.min) <= parseFloat(v.metadata.range.max)) : true;
        const catsOk = !isQ ? (v.metadata.categories.length > 0) : true;
        return hasName && hasDesc && rangeOk && catsOk;
    };

    const closeAllUI = () => {
        document.getElementById('lib-menu').classList.add('hidden');
        document.getElementById('drawer').style.transform = 'translateX(100%)';
        document.getElementById('overlay').style.opacity = '0';
        document.getElementById('overlay').style.pointerEvents = 'none';
    };

    return {
        init: () => {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) { try { const p = JSON.parse(saved); if (p.project) db = p; } catch (e) {} }
            document.getElementById('p-name').value = db.project.name || '';
            document.getElementById('p-spec').value = db.project.specialty || '';
            document.getElementById('p-date').value = db.project.date || '';
            VarOpsApp.render();
            document.addEventListener('click', (e) => {
                const libBtn = document.getElementById('lib-btn');
                const libMenu = document.getElementById('lib-menu');
                if (libBtn && libMenu && !libBtn.contains(e.target) && !libMenu.contains(e.target)) libMenu.classList.add('hidden');
            });
        },

        render: () => {
            const tbody = document.getElementById('rows');
            const emptyState = document.getElementById('empty-state');
            if (!tbody) return;
            
            if (db.variables.length === 0) {
                tbody.innerHTML = '';
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
                tbody.innerHTML = '';
                let completed = 0;

                db.variables.forEach((v, i) => {
                    const ok = validateVar(v);
                    if (ok) completed++;
                    const isQ = v.type.includes('Cuantitativa');
                    const tr = document.createElement('tr');
                    tr.className = `border-b border-slate-200 transition-colors ${!ok ? 'bg-red-50' : 'hover:bg-slate-50'}`;
                    tr.innerHTML = `
                        <td class="p-4 text-slate-400 font-mono text-xs text-center border-r border-slate-100">
                            <div class="flex flex-col items-center gap-1">
                                <button onclick="VarOpsApp.moveVar(${i},-1)" class="${i===0?'invisible':'text-slate-300 hover:text-blue-600'}">▲</button>
                                <span class="font-bold text-slate-900">${i + 1}</span>
                                <button onclick="VarOpsApp.moveVar(${i},1)" class="${i===db.variables.length-1?'invisible':'text-slate-300 hover:text-blue-600'}">▼</button>
                            </div>
                        </td>
                        <td class="p-3"><input type="text" value="${escapeHTML(v.name)}" oninput="VarOpsApp.updateVal(${i},'name',this.value)" class="table-input font-bold text-blue-900" placeholder="etiqueta"></td>
                        <td class="p-3"><select onchange="VarOpsApp.updateVal(${i},'type',this.value); VarOpsApp.render();" class="table-input font-bold text-slate-500 uppercase text-[10px]">${STAT_TYPES.map(t => `<option ${v.type===t?'selected' : ''}>${t}</option>`).join('')}</select></td>
                        <td class="p-3">${isQ ? VarOpsApp.renderQuantScale(v, i) : VarOpsApp.renderQualScale(v, i)}</td>
                        <td class="p-3"><textarea oninput="VarOpsApp.updateVal(${i},'description',this.value)" class="table-input resize-none text-slate-700 leading-tight" rows="1" placeholder="Descripción obligatoria...">${escapeHTML(v.description)}</textarea></td>
                        <td class="p-3 text-center border-l border-slate-100">
                            <div class="flex items-center justify-center gap-2">
                                <button onclick="VarOpsApp.openDrawer(${i})" class="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center transition-all ${VarOpsApp.hasMeta(v)?'bg-blue-600 text-white border-blue-600 shadow-md':'bg-white text-slate-400 hover:bg-slate-900 hover:text-white'}">⚙️</button>
                                <button onclick="VarOpsApp.deleteVar(${i})" class="w-10 h-10 rounded-lg bg-white border border-red-100 text-red-300 hover:bg-red-600 hover:text-white transition-all font-bold">×</button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
                document.getElementById('progress-counter').textContent = `${completed} / ${db.variables.length} COMPLETAS`;
            }
            VarOpsApp.renderLib();
        },

        renderQuantScale: (v, i) => {
            const m = v.metadata.range;
            const err = m.min !== "" && m.max !== "" && parseFloat(m.min) > parseFloat(m.max);
            if (m.min || m.max || v.metadata.unit) {
                return `<div class="px-3 py-1.5 ${err?'bg-red-600 text-white':'bg-blue-100 text-blue-900'} rounded-md text-[10px] font-bold border ${err?'border-red-700':'border-blue-200'}">
                    ${escapeHTML(m.min) || '?'} — ${escapeHTML(m.max) || '?'} <span class="uppercase opacity-70">${escapeHTML(v.metadata.unit) || ''}</span>
                </div>`;
            }
            return `<button onclick="VarOpsApp.openDrawer(${i})" class="text-[10px] text-slate-400 font-bold uppercase underline">Definir escala</button>`;
        },

        renderQualScale: (v, varIdx) => {
            const cats = v.metadata.categories;
            if (cats.length === 0) return `<input type="text" onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault();VarOpsApp.addCat(${varIdx},this)}" placeholder="Añadir categorías..." class="table-input italic text-xs">`;
            const tags = cats.map((c, ci) => `<span class="tag">${escapeHTML(c.label)}<button onclick="VarOpsApp.removeCat(${varIdx},${ci})" class="text-slate-500 hover:text-red-400 ml-1">×</button></span>`).join('');
            return `<div class="flex flex-wrap gap-1 items-center px-1">${tags}<input type="text" onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault();VarOpsApp.addCat(${varIdx},this)}" placeholder="+" class="w-8 outline-none text-blue-600 font-black text-sm bg-transparent"></div>`;
        },

        openDrawer: (idx) => {
            closeAllUI();
            const v = db.variables[idx]; const isQ = v.type.includes('Cuantitativa');
            document.getElementById('drawer-body').innerHTML = `
                <div class="flex justify-between items-center mb-8 pb-4 border-b"><div><h2 class="text-2xl font-black text-slate-900">${escapeHTML(v.name).toUpperCase()||'AJUSTES'}</h2><p class="text-xs font-bold text-blue-600 uppercase">Configuración de Calidad</p></div><button onclick="VarOpsApp.closeDrawer()" class="text-slate-400 hover:text-slate-900 text-4xl font-light">×</button></div>
                <div class="space-y-8">
                    <div><label class="block text-[10px] font-bold text-slate-400 uppercase mb-2">Pregunta en el Cuestionario</label><textarea oninput="VarOpsApp.updateMetaField(${idx},'question',this.value)" class="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 ring-blue-50 outline-none text-lg font-bold transition-all" rows="3">${escapeHTML(v.metadata.question)}</textarea></div>
                    <div><h4 class="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest border-l-4 border-blue-500 pl-2">Reglas de Limpieza</h4>
                    ${isQ ? `<div class="space-y-6"><input type="text" value="${escapeHTML(v.metadata.unit)}" oninput="VarOpsApp.updateMetaField(${idx},'unit',this.value)" class="table-input font-bold" placeholder="Unidad (mg/dL, años...)"><div class="grid grid-cols-2 gap-4"><div><label class="text-[9px] font-bold text-slate-400 uppercase">Mínimo</label><input type="text" value="${escapeHTML(v.metadata.range.min)}" oninput="VarOpsApp.updateRangeField(${idx},'min',this.value)" class="table-input font-black text-center text-xl"></div><div><label class="text-[9px] font-bold text-slate-400 uppercase">Máximo</label><input type="text" value="${escapeHTML(v.metadata.range.max)}" oninput="VarOpsApp.updateRangeField(${idx},'max',this.value)" class="table-input font-black text-center text-xl"></div></div></div>` : 
                    `<div class="space-y-3">${v.metadata.categories.map(c => `<div class="p-4 bg-slate-50 rounded-xl border border-slate-200"><span class="text-[10px] font-black text-slate-500 uppercase">${escapeHTML(c.label)}</span><input type="text" value="${escapeHTML(c.synonyms.join(', '))}" oninput="VarOpsApp.updateSynonyms(${idx},'${c.label.replace(/'/g,"\\'")}',this.value)" class="w-full mt-1 p-1 font-bold border-b border-blue-200 bg-transparent outline-none focus:border-blue-600" placeholder="Sinónimos o códigos..."></div>`).join('')}</div>`}
                    </div>
                </div><button onclick="VarOpsApp.closeDrawer()" class="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-sm mt-16 shadow-xl hover:bg-blue-600 transition-all">Guardar Cambios</button>
            `;
            document.getElementById('drawer').style.transform = 'translateX(0)';
            document.getElementById('overlay').style.opacity = '1'; document.getElementById('overlay').style.pointerEvents = 'auto';
        },

        addNewVar: () => { closeAllUI(); if (db.variables.length > 0 && !validateVar(db.variables[db.variables.length-1])) { alert("⚠️ Variable incompleta."); return; } db.variables.push({ name: '', type: 'Cuantitativa Continua', description: '', metadata: { question: '', unit: '', range: { min: '', max: '' }, categories: [] } }); VarOpsApp.render(); save(); },
        addFromLib: (k) => { closeAllUI(); db.variables.push(JSON.parse(JSON.stringify(CLINICAL_LIBRARY[k]))); save(); VarOpsApp.render(); },
        updateProj: (f, v) => { db.project[f] = v; save(); },
        updateVal: (i, f, v) => { if(f==='name') v=v.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''); db.variables[i][f]=v; save(); },
        deleteVar: (i) => { if(confirm("¿Eliminar?")){ db.variables.splice(i,1); save(); VarOpsApp.render(); }},
        moveVar: (idx, delta) => { const n=idx+delta; if(n<0||n>=db.variables.length)return; [db.variables[idx],db.variables[n]]=[db.variables[n],db.variables[idx]]; save(); VarOpsApp.render(); },
        addCat: (i, el) => { const val=el.value.trim().replace(/,/g,''); if(val && !db.variables[i].metadata.categories.find(c=>c.label===val)){ db.variables[i].metadata.categories.push({label:val,synonyms:[]}); save(); VarOpsApp.render(); } el.value=''; },
        removeCat: (vi, ci) => { db.variables[vi].metadata.categories.splice(ci,1); save(); VarOpsApp.render(); },
        updateMetaField: (i,f,v) => { db.variables[i].metadata[f]=v; save(); },
        updateRangeField: (i,f,v) => { db.variables[i].metadata.range[f]=v; save(); },
        updateSynonyms: (idx, label, val) => { const c=db.variables[idx].metadata.categories.find(x=>x.label===label); if(c) c.synonyms=val.split(',').map(s=>s.trim()).filter(s=>s!==''); save(); },
        closeDrawer: () => closeAllUI(),
        toggleLibrary: () => { const m = document.getElementById('lib-menu'); const h = m.classList.contains('hidden'); closeAllUI(); if(h) m.classList.remove('hidden'); },
        renderLib: () => {
            const menu = document.getElementById('lib-menu'); if (!menu) return;
            menu.innerHTML = '<p class="text-[10px] font-black text-slate-400 uppercase p-4 border-b border-slate-100">Catálogo Clínico</p>';
            Object.keys(CLINICAL_LIBRARY).forEach(k => {
                const item=CLINICAL_LIBRARY[k]; const btn=document.createElement('button');
                btn.className="w-full text-left p-6 hover:bg-blue-50 border-b border-slate-50 transition-all flex items-center justify-between group";
                btn.innerHTML=`<span class="text-slate-800 font-bold text-sm">${item.description}</span><span class="text-[9px] bg-slate-200 px-2 py-1 rounded text-slate-500 font-black uppercase">${item.name}</span>`;
                btn.onclick=()=>VarOpsApp.addFromLib(k); menu.appendChild(btn);
            });
        },
        exportData: () => { const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Investigacion_${db.project.name || 'Master'}.clinical`; a.click(); },
        importData: (e) => { const file=e.target.files[0]; if(file){ const reader=new FileReader(); reader.onload=(x)=>{ try{ const d=JSON.parse(x.target.result); if(d.project){ db=d; save(); location.reload(); } }catch(err){ alert("Error"); }}; reader.readAsText(file); } },
        resetSystem: () => { if(confirm("Wipe all data?")){ localStorage.removeItem(STORAGE_KEY); location.reload(); } },
        copyToWord: () => {
            let html=`<table style="border-collapse: collapse; width: 100%; font-family: 'Times New Roman', serif; border-top: 2pt solid black; border-bottom: 2pt solid black;"><thead><tr style="border-bottom: 1pt solid black;"><th style="padding: 10px; text-align: left;">Variable</th><th style="padding: 10px; text-align: left;">Tipo</th><th style="padding: 10px; text-align: left;">Escala / Valores</th><th style="padding: 10px; text-align: left;">Descripción</th></tr></thead><tbody>`;
            db.variables.forEach(v => {
                let esc = v.type.includes('Cuantitativa') ? `${v.metadata.range.min || '?'}-${v.metadata.range.max || '?'} ${v.metadata.unit || ''}` : v.metadata.categories.map(c => c.label).join(', ');
                html += `<tr style="border-bottom: 1px solid black;"><td style="padding: 10px; font-weight: bold;">${v.name}</td><td style="padding: 10px;">${v.type}</td><td style="padding: 10px; font-weight: bold; color: #2563eb;">${esc}</td><td style="padding: 10px;">${v.description}</td></tr>`;
            });
            html += `</tbody></table>`;
            const blob = new Blob([html], { type: 'text/html' });
            navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]).then(() => alert("✅ Tabla copiada con éxito."));
        },
        hasMeta: (v) => v.metadata.question || v.metadata.unit || v.metadata.range.min || v.metadata.range.max || v.metadata.categories.some(c => c.synonyms.length > 0),
    };
})();

window.onload = () => VarOpsApp.init();
