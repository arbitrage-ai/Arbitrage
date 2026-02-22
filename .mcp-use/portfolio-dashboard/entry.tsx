import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import Component from '/Users/suryaakella/Documents/Public-ESPN-API/resources/portfolio-dashboard/widget.tsx'

const container = document.getElementById('widget-root')
if (container && Component) {
  const root = createRoot(container)
  root.render(<Component />)
}
