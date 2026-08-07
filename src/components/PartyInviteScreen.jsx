// src/components/PartyInviteScreen.jsx
// Overlay de una sola vez (ver onboarding.js#hasSeenPartyInvite), aparece cuando el jugador sale
// de la primera Batalla que termina en su vida — mismo fondo que TitleScreen.jsx (title-bg.jpg),
// para que se sienta como "otra vez esa promesa inicial", ahora con la invitación concreta de
// seguir escaneando para armar el equipo perfecto.
export default function PartyInviteScreen({ onContinue }) {
  return (
    <div className="party-invite">
      <div className="party-invite-art" />
      <div className="party-invite-overlay" />

      <div className="party-invite-content">
        <h1 className="party-invite-heading">¡Tu aventura recién empieza!</h1>
        <p className="party-invite-body">
          Seguí escaneando productos para armar el Party perfecto — cada código puede ser el héroe
          que te falta para vencer a cualquier rival.
        </p>
        <button type="button" className="scan-again party-invite-cta" onClick={onContinue}>
          📷 Seguir escaneando
        </button>
      </div>
    </div>
  );
}
