import React, { useState, useMemo, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const REGION_HOURS = {
  'Andina': 5.0,
  'Caribe': 5.5,
  'Pacífica': 4.8,
  'Orinoquía': 5.2,
  'Amazonía': 4.5,
  'Bogotá (Altura)': 4.2
}

export default function CalculadoraSolarInteractiva(){
  const [mode, setMode] = useState('consumo') // 'consumo' or 'potencia'
  const [consumptionValue, setConsumptionValue] = useState(300) // kWh/month
  const [consumptionPeriod, setConsumptionPeriod] = useState('monthly')
  const [desiredPowerKW, setDesiredPowerKW] = useState(5) // kW to install if mode === 'potencia'
  const [region, setRegion] = useState('Andina')
  const [panelWatt, setPanelWatt] = useState(450)
  const [lossesPercent, setLossesPercent] = useState(20)
  const [autonomyDays, setAutonomyDays] = useState(0)
  const [dodPercent, setDodPercent] = useState(80)
  const [inverterFactor, setInverterFactor] = useState(1.25)

  const reportRef = useRef()

  const peakSunHours = REGION_HOURS[region] || 5.0

  const dailyKwh = useMemo(() => {
    if (mode === 'consumo') {
      if (consumptionPeriod === 'monthly') return (consumptionValue || 0) / 30
      return consumptionValue || 0
    } else {
      // If user provides desired power in kW, estimate energy produced per day:
      // energy per day (kWh) = desiredPowerKW (kW) * peakSunHours
      return (desiredPowerKW || 0) * peakSunHours
    }
  }, [mode, consumptionValue, consumptionPeriod, desiredPowerKW, peakSunHours])

  const results = useMemo(() => {
    const whPerDay = dailyKwh * 1000
    const systemEfficiency = 1 - lossesPercent / 100
    const requiredArrayW = peakSunHours > 0 ? Math.ceil(whPerDay / (peakSunHours * systemEfficiency)) : 0
    const numPanels = panelWatt > 0 ? Math.ceil(requiredArrayW / panelWatt) : 0
    const arrayPeakPowerKW = Math.round((numPanels * panelWatt) / 1000 * 100) / 100
    const suggestedInverterKW = Math.ceil((arrayPeakPowerKW * inverterFactor) * 100) / 100

    let batteryKwh = 0
    if (autonomyDays > 0) {
      const inverterEfficiency = 0.95
      const usableFraction = (dodPercent / 100) * inverterEfficiency
      batteryKwh = Math.ceil(((dailyKwh * autonomyDays) / usableFraction) * 100) / 100
    }

    return {
      dailyKwh: Math.round(dailyKwh * 100) / 100,
      whPerDay,
      requiredArrayW,
      numPanels,
      arrayPeakPowerKW,
      suggestedInverterKW,
      batteryKwh
    }
  }, [dailyKwh, peakSunHours, panelWatt, lossesPercent, autonomyDays, dodPercent, inverterFactor])

  const chartData = [
    { name: 'Consumo (kWh/d)', value: results.dailyKwh },
    { name: 'Potencia array (kW)', value: results.arrayPeakPowerKW },
    { name: 'Inversor (kW)', value: results.suggestedInverterKW }
  ]

  function downloadPDF(){
    const node = reportRef.current
    if(!node) return
    html2canvas(node, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p','mm','a4')
      const imgProps = pdf.getImageProperties(imgData)
      const pdfWidth = 190
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth, pdfHeight)
      pdf.save('reporte-calculadora-solar.pdf')
    })
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-lg" ref={reportRef}>
      <h1 className="text-2xl font-bold mb-4">Calculadora Solar — Colombia</h1>
      <p className="text-sm text-gray-600 mb-4">Personalizada por región (horas pico de sol) y con modo por consumo o por potencia a instalar.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium">Modo de cálculo</span>
            <div className="mt-1 flex gap-2">
              <button onClick={() => setMode('consumo')} className={`px-3 py-2 rounded ${mode==='consumo' ? 'bg-blue-600 text-white' : 'border'}`}>Por consumo</button>
              <button onClick={() => setMode('potencia')} className={`px-3 py-2 rounded ${mode==='potencia' ? 'bg-blue-600 text-white' : 'border'}`}>Por potencia (kW)</button>
            </div>
          </label>

          {mode === 'consumo' ? (
            <label className="block">
              <span className="text-sm font-medium">Consumo</span>
              <div className="mt-1 flex gap-2">
                <input type="number" min="0" value={consumptionValue} onChange={(e)=>setConsumptionValue(Number(e.target.value))} className="flex-1 p-2 rounded border"/>
                <select value={consumptionPeriod} onChange={(e)=>setConsumptionPeriod(e.target.value)} className="p-2 rounded border">
                  <option value="monthly">kWh / mes</option>
                  <option value="daily">kWh / día</option>
                </select>
              </div>
              <small className="text-xs text-gray-500">Ej: 900 kWh/mes o 30 kWh/día.</small>
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-medium">Potencia deseada a instalar (kW)</span>
              <input type="number" min="0" step="0.1" value={desiredPowerKW} onChange={(e)=>setDesiredPowerKW(Number(e.target.value))} className="w-full p-2 rounded border mt-1"/>
              <small className="text-xs text-gray-500">Ej: 10 kW para pequeña industria.</small>
            </label>
          )}

          <label className="block">
            <span className="text-sm font-medium">Región (Colombia)</span>
            <select value={region} onChange={(e)=>setRegion(e.target.value)} className="w-full p-2 rounded border mt-1">
              {Object.keys(REGION_HOURS).map(r => <option key={r} value={r}>{r} — {REGION_HOURS[r]} h/d</option>)}
            </select>
            <small className="text-xs text-gray-500">Horas pico de sol estimadas por región.</small>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Potencia del panel (W)</span>
            <select value={panelWatt} onChange={(e)=>setPanelWatt(Number(e.target.value))} className="w-full p-2 rounded border mt-1">
              <option value={300}>300 W</option>
              <option value={370}>370 W</option>
              <option value={450}>450 W</option>
              <option value={540}>540 W</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Pérdidas del sistema (%)</span>
            <input type="number" min="0" max="50" value={lossesPercent} onChange={(e)=>setLossesPercent(Number(e.target.value))} className="w-full p-2 rounded border mt-1"/>
            <small className="text-xs text-gray-500">Incluye temperatura, cableado y sombras (18–22% recomendado).</small>
          </label>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Autonomía (días) — baterías</span>
            <input type="number" min="0" value={autonomyDays} onChange={(e)=>setAutonomyDays(Number(e.target.value))} className="w-full p-2 rounded border mt-1"/>
          </label>

          <label className="block">
            <span className="text-sm font-medium">DOD (%) batería</span>
            <input type="number" min="10" max="100" value={dodPercent} onChange={(e)=>setDodPercent(Number(e.target.value))} className="w-full p-2 rounded border mt-1"/>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Factor inversor</span>
            <input type="number" min="1" step="0.05" value={inverterFactor} onChange={(e)=>setInverterFactor(Number(e.target.value))} className="w-full p-2 rounded border mt-1"/>
          </label>

          <div className="p-4 border rounded bg-gray-50">
            <h3 className="font-semibold">Resultados</h3>
            <div className="mt-2 text-sm space-y-2">
              <div>Consumo/Generación diaria estimada: <strong>{results.dailyKwh} kWh/día</strong></div>
              <div>Potencia del arreglo necesaria: <strong>{results.requiredArrayW} W</strong></div>
              <div>Número de paneles (~{panelWatt} W): <strong>{results.numPanels}</strong></div>
              <div>Potencia pico del arreglo: <strong>{results.arrayPeakPowerKW} kW</strong></div>
              <div>Inversor recomendado: <strong>{results.suggestedInverterKW} kW</strong></div>
              {autonomyDays > 0 && (<div>Batería estimada (capacidad útil): <strong>{results.batteryKwh} kWh</strong></div>)}
            </div>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          // preset hogar
          setMode('consumo'); setConsumptionValue(900); setConsumptionPeriod('monthly'); setRegion('Andina'); setPanelWatt(450); setLossesPercent(20); setAutonomyDays(0);
        }} className="px-4 py-2 rounded bg-blue-600 text-white">Ejemplo: Hogar (900 kWh/mes)</button>

        <button onClick={() => {
          setMode('consumo'); setConsumptionValue(8000); setConsumptionPeriod('monthly'); setRegion('Caribe'); setPanelWatt(540); setLossesPercent(18); setAutonomyDays(1);
        }} className="px-4 py-2 rounded bg-green-600 text-white">Ejemplo: Pequeña industria (8000 kWh/mes)</button>

        <button onClick={downloadPDF} className="px-4 py-2 rounded bg-gray-800 text-white">Descargar reporte PDF</button>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <strong>Nota:</strong> Estos cálculos son estimaciones. Valida con un instalador para detalles de sombreado, orientación y normativa local.
      </div>
    </div>
  )
}
