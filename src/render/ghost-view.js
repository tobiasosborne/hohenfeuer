// src/render/ghost-view.js - owns translucent placement previews and wire outlines for pending designations.
import * as THREE from 'three';
import { JOB } from '../contracts.js';

/** A single reusable preview and one line batch for all pending block/cannon/removal orders. */
export function createGhostView({ scene }) {
  const group = new THREE.Group(); group.name = 'construction-ghosts'; scene.add(group);
  const box = new THREE.BoxGeometry(1.006, 1.006, 1.006);
  const material = new THREE.MeshBasicMaterial({ color: 0x45ee78, opacity: 0.32, transparent: true, depthWrite: false });
  const preview = new THREE.Group(); preview.name = 'placement-ghost'; group.add(preview);
  const block = new THREE.Mesh(box, material); preview.add(block);
  const barrelGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.3, 8);
  const barrel = new THREE.Mesh(barrelGeo, material); barrel.rotation.x = Math.PI / 2; barrel.position.y = 0.12;
  preview.add(barrel);
  const geometry = new THREE.BufferGeometry(), lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
  const outlines = new THREE.LineSegments(geometry, lineMaterial); outlines.name = 'designation-outlines'; group.add(outlines);
  const edges = new THREE.EdgesGeometry(box), coords = edges.getAttribute('position').array;
  let signature = '', count = 0;

  function update(state, { ghost = null, plot = null, build = null } = {}) {
    preview.visible = !!ghost && !!plot;
    if (preview.visible) {
      preview.position.set(plot.origin.x + ghost.cell[0] + 0.5, plot.origin.y + ghost.cell[1] + 0.5, plot.origin.z + ghost.cell[2] + 0.5);
      material.color.setHex(ghost.valid ? 0x45ee78 : 0xff493e);
      const weapon = build?.mode === 'weapon'; barrel.visible = weapon;
      block.scale.set(weapon ? 0.7 : 1, weapon ? 0.45 : 1, weapon ? 0.7 : 1);
      preview.rotation.y = -(ghost.facing ?? 0) * Math.PI / 2;
    }
    const designations = state.castles.flatMap(c => (c.npcDesignations ?? []).map(d => ({ ...d, origin: c.plot.origin, slot: c.slot })));
    outlines.visible = designations.length > 0;
    const next = designations.map(d => `${d.slot}:${d.cell}:${d.kind}:${d.weapon ?? ''}`).join('|');
    if (next !== signature) {
      signature = next; count = designations.length;
      const positions = new Float32Array(count * coords.length), colors = new Float32Array(positions.length);
      for (let n = 0; n < count; n++) {
        const d = designations[n], color = new THREE.Color(d.kind === JOB.DEMOLISH ? 0xff7448 : d.weapon ? 0xffd36a : 0x66bdff);
        for (let i = 0; i < coords.length; i += 3) {
          const base = n * coords.length + i;
          positions[base] = coords[i] + d.origin.x + d.cell[0] + 0.5;
          positions[base + 1] = coords[i + 1] + d.origin.y + d.cell[1] + 0.5;
          positions[base + 2] = coords[i + 2] + d.origin.z + d.cell[2] + 0.5;
          colors.set([color.r, color.g, color.b], base);
        }
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeBoundingSphere();
    }
    return count;
  }
  return { group, preview, outlines, update, get count() { return count; }, dispose() {
    scene.remove(group); box.dispose(); barrelGeo.dispose(); edges.dispose(); geometry.dispose(); material.dispose(); lineMaterial.dispose();
  } };
}
