"use client";

import Link from "next/link";

export function VidyalankarLogo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <img
        src="/vidlogo.png"
        alt="Vidyalankar Logo"
        style={{
          height: '76px',
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  );
}

export function AuthHero() {
  return (
    <div className="hero-section">
      <div className="bg-circle bg-circle-1" />
      <div className="bg-circle bg-circle-2" />
      <div className="bg-circle bg-circle-3" />
      <div className="bg-grid-pattern" />

      <div className="hero-content">
        <VidyalankarLogo />

        <div className="service-subtitle">
          Supercomputer &amp; GPU Resource Management Platform
        </div>

        <div className="feature-cards">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <span>Supercomputer &amp; GPU Slot Booking</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <span>Automated Ubuntu Docker Provisioning</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span>Persistent Storage &amp; SSH Access</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <span>Live Session Monitoring &amp; Controls</span>
          </div>
        </div>

        <div className="tag-pills">
          <span className="tag-pill">VDT</span>
          <span className="tag-pill">VIT</span>
          <span className="tag-pill">VP</span>
          <span className="tag-pill">VSIT</span>
        </div>
      </div>
    </div>
  );
}
