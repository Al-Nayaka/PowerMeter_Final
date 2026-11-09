import { useState } from 'react'

export function RelayCard() {
  const [relayOn, setRelayOn] = useState(false)

  return (
    <section className="card relay-card">
      <div className="relay-head">
        <span className="card-label">Relay</span>
        <button
          type="button"
          className={`toggle${relayOn ? ' is-on' : ''}`}
          role="switch"
          aria-checked={relayOn}
          aria-label="Relay"
          onClick={() => setRelayOn((on) => !on)}
        >
          <span className="knob" />
        </button>
      </div>

      <div className="relay-row row">
        <span className="label">Status</span>
        <strong>{relayOn ? 'ON' : 'OFF'}</strong>
      </div>
    </section>
  )
}

export function TotalUsageCard() {
  return (
    <section className="card">
      <span className="card-label">Total penggunaan watt</span>
      <div className="big-value total-value">
        10,29<span className="unit">kWh</span>
      </div>
      <p className="card-sub">Energi terpakai hari ini</p>

      <div className="info-rows">
        <div className="row">
          <span className="label">Biaya</span>
          <strong>Rp14.865</strong>
        </div>
        <div className="row">
          <span className="label">Estimasi sebulan</span>
          <strong>Rp445.964</strong>
        </div>
        <div className="row">
          <span className="label">Daya semu</span>
          <strong>1.556 VA</strong>
        </div>
      </div>
    </section>
  )
}

export function PowerFactorCard() {
  return (
    <section className="card">
      <span className="card-label">Power factor</span>
      <div className="big-value pf-value">0,96</div>

      <div
        className="progress"
        role="progressbar"
        aria-valuenow={96}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Power factor"
      >
        <span style={{ width: '96%' }} />
      </div>

      <p className="pf-note">
        <strong>Baik.</strong> Idealnya di atas 0,85.
      </p>

      <div className="info-rows">
        <div className="row">
          <span className="label">PF terendah</span>
          <strong>0,88</strong>
        </div>
      </div>
    </section>
  )
}

export function ReactivePowerCard() {
  return (
    <section className="card">
      <span className="card-label">Daya reaktif</span>
      <div className="big-value reactive-value">
        455<span className="unit">VAR</span>
      </div>
      <p className="card-desc">
        Daya bolak-balik pada beban induktif seperti kipas dan kulkas.
      </p>

      <div className="info-rows">
        <div className="row">
          <span className="label">Puncak</span>
          <strong>744 VAR</strong>
        </div>
      </div>
    </section>
  )
}
