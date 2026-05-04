# 3D galaxy map — implementation guide

This document describes how to upgrade the existing 2D map at `/map` into an immersive 3D "company galaxy" using `react-three-fiber` (a React renderer for the Three.js 3D engine).

It is structured for two audiences:

- **Part A: Prompts** — copy-paste blocks you can hand to Claude Code, one at a time. Best if you don't write code yourself.
- **Part B: Tutorial** — a step-by-step walk-through with full explanations, dependency lists, file diffs, and what each step does and *why*. Best if you want to understand or do it yourself.

Both parts produce the same end result.

The **2D version already shipped** at `app/(protected)/map/`. Treat that as a working baseline. The 3D version will live at `/map/3d` so you can compare them side by side, and you can swap them later by changing the nav link.

---

## What you're building

An interactive 3D scene rendered in the browser:

- A glowing **company sun** at the centre.
- **Team planets** orbiting it on tilted rings, sized by headcount.
- **People moons** orbiting their team, each with their real avatar mapped onto a sphere.
- **Workflow stars** drifting in clouds around the people who own them, with **comet trails** for those with active AI interventions.
- **Edges** that fade in when you hover something — light streams between connected nodes.
- **Camera** pans on drag, zooms on scroll, and animates smoothly to a focused node on click.
- A **time scrubber** drags the whole scene through 12 weeks of metric history.
- A **heat-mode toggle** recolours workflows by time saved, cost saved, error rate, or revenue impact.
- Optional **post-processing** (bloom, vignette, depth-of-field) for the cinematic look.

End-to-end timing: about **10–14 hours of focused work** (call it 2 working days), assuming the 2D version is already in place. With Claude Code as the executor, this collapses to roughly **3–4 sessions of 30–60 minutes** of your time, since most of the work is generating and iterating on code.

---

# Part A — Prompts to give Claude Code

These prompts assume you are working in this repository (`phlo-workshop`) on `main`, with the 2D map at `app/(protected)/map/` already present.

Run them **one at a time**, in order. After each prompt, run `npm run dev` and visit `/map/3d` to confirm the new behaviour before moving to the next one. If a step breaks, paste the error back to Claude Code and ask it to fix it before continuing.

---

### Prompt 1 — Install dependencies and create the empty 3D page (~10 min)

```
We are upgrading the 2D map at app/(protected)/map/ into a 3D version. The
3D version should live at app/(protected)/map/3d/ so we can keep both pages.

Step 1 of 6.

1. Install these packages:
     - three
     - @react-three/fiber
     - @react-three/drei
     - @react-three/postprocessing
   And dev deps: @types/three.

2. Create app/(protected)/map/3d/page.tsx as a server component that:
     - Reuses the same Supabase data-loading code as
       app/(protected)/map/page.tsx (extract it into a shared
       lib/galaxy-data.ts module if cleaner)
     - Passes a GalaxyData shape to a new client component
       app/(protected)/map/3d/_components/galaxy3d.tsx

3. Create that client component as a placeholder: a full-bleed div with a
   <Canvas> from @react-three/fiber containing one <mesh> rendering an
   orange sphere and an <OrbitControls> from @react-three/drei. Add a
   <color attach="background" args={["#05060d"]} /> so the background is
   deep space.

4. Add a "3D Map" link in app/(protected)/_components/header.tsx pointing
   to /map/3d, alongside the existing "Map" link.

Verify: `npm run dev`, navigate to /map/3d, see an orange sphere you can
orbit with the mouse. The existing 2D /map should still work unchanged.
```

---

### Prompt 2 — The company sun and team planets (~45 min)

```
Step 2 of 6.

In app/(protected)/map/3d/_components/galaxy3d.tsx, replace the placeholder
mesh with the start of the real scene:

1. Render a "company sun" at origin: a glowing yellow sphere using a
   <meshStandardMaterial emissive> with high emissive intensity. Wrap it in
   a <Bloom> effect from @react-three/postprocessing inside an
   <EffectComposer>. Add ambient + point light.

2. For each team in `data.teams`, render a "team planet" sphere:
     - Position on a circular orbit around the sun. Spread teams evenly:
       angle = (i / teams.length) * 2π. Radius ~6 units.
     - Tilt each orbit slightly: rotate the team group on a small random
       (but stable per id) X/Z axis tilt so orbits aren't all coplanar.
     - Animate the team slowly around its orbit using useFrame.
     - Material: blue-grey, low emissive.
     - Size: 0.4 + (peopleOnTeam * 0.05) up to a max of 0.9.

3. Add a faint orbital ring per team using <ringGeometry>.

4. Add `<OrbitControls enableDamping dampingFactor={0.05} maxDistance={20}
   minDistance={3} />` so the user can fly around.

The team's data.people array gives you headcount per team via
people.filter(p => p.team === team.name).length.

Verify: at /map/3d you see a glowing sun with N team planets slowly orbiting
on tilted rings, each surrounded by a faint ring. You can orbit the camera.
```

---

### Prompt 3 — People moons with avatars (~1.5 hours)

```
Step 3 of 6.

For each person in data.people whose `team` matches a known team, render a
"moon" orbiting that team's planet:

1. Create a small sphere (~0.12 units) and orbit it around the team planet
   at radius 0.8–1.2 units, with each person at a different orbit angle
   plus a stable tilt.

2. Map the person's avatar onto the sphere as a texture. Use
   useTexture(person.avatarUrl) from @react-three/drei. Wrap each moon in a
   <Suspense fallback={null}> so loading individual avatars never blocks
   the scene.

3. Because Dicebear returns SVG, use <Html> from drei as a fallback for
   moons whose texture failed: render a small circular div with the avatar
   img. (Or convert the SVG to a raster texture in a separate utility —
   see the tutorial in docs/3d-galaxy-map.md for one way.)

4. Animate moons: their orbit speed should be slow but visible. Use
   useFrame and update the angle each tick.

Verify: each team planet has 0–N moons orbiting it, each showing the
person's avatar on a sphere. Avatars should look reasonable from any camera
angle.
```

---

### Prompt 4 — Workflow stars with comet trails (~1.5 hours)

```
Step 4 of 6.

For each workflow in data.workflows, render a "star":

1. Use an <Instances> from drei (or instancedMesh) so all workflows render
   in a single draw call — this is critical for performance with many
   workflows.

2. Place each workflow:
     - If it has owners: anchor it near one of its owner moons with a small
       random offset.
     - If no owners: anchor it near its team planet.

3. Size by frequencyPerWeek; brightness by criticality (use emissive
   intensity). Colour by the active heat metric (default: criticality), the
   same colour scale used in the 2D map (lerp green → blue → red).

4. For workflows with activeInterventions > 0:
     - Render a small particle trail behind the star using a <points>
       geometry with ~30 vertices fading from gold to transparent.
     - Animate the trail to drift behind the star's motion.

5. Regulatory workflows: render a thin red ring around the star.

Verify: clusters of glowing stars appear around each person moon and team
planet. Workflows with active interventions show a gold comet trail. The
default colour distribution makes higher-criticality workflows visibly
hotter.
```

---

### Prompt 5 — Interaction: hover, click, edges, focus camera (~2 hours)

```
Step 5 of 6.

Wire up interactivity:

1. Hover detection: add onPointerOver / onPointerOut to each node mesh.
   Track hoveredId in component state. While hovering, scale the node up
   ~10% with a useSpring animation from @react-spring/three (install if
   needed). Show a small <Html> tooltip with the node's name.

2. Click selection: onClick sets selectedId. Use the camera-flying helper
   from drei: import { CameraControls } and animate the camera to focus on
   the selected node's world position. Restore on deselect (Esc key or
   clicking empty space).

3. Edges: when something is hovered or selected, render <Line> instances
   from drei between that node and its 1-hop neighbours (team→people,
   person→workflows). Edges should be thin glowing lines, dim by default,
   bright on focus. Reuse the same neighbour-finding logic from the 2D map.

4. Add a Toolbar overlay (HTML, absolute-positioned) with the same
   controls as the 2D map: heat-mode dropdown, team filter dropdown, and
   the time scrubber. Wire them into the same state shape as galaxy.tsx so
   we can later share logic.

Verify: hover any node and it lifts + shows a tooltip. Click a team and
the camera flies to it; click empty space to fly back. Edges illuminate
between focused node and neighbours.
```

---

### Prompt 6 — Polish: post-processing, time scrubbing, mobile (~2 hours)

```
Step 6 of 6.

Final pass:

1. Post-processing: inside <EffectComposer>, add Bloom (intensity 1.2,
   luminanceThreshold 0.4), Vignette (offset 0.5, darkness 0.6), and a
   subtle DepthOfField focused on the selected node when one is selected.

2. Time scrubber: when the slider moves, recolour all workflow stars'
   emissive based on the heat metric value at that date. Use the
   historyIndex / heatRange precomputation from the 2D map. The change
   should be smoothly animated — interpolate emissive intensity over ~300ms.

3. Performance:
     - Wrap heavy children in React.memo.
     - Use <Stats /> from drei in dev only and check we hold 60fps with
       ~100 workflows.
     - If frame rate drops, reduce particle count on comet trails or cap
       active comet trails to the 20 most-recently-updated workflows.

4. Mobile / small screens: hide the 3D canvas on widths < 768px and show a
   message "Open on a desktop for the best view." The 2D map is the
   mobile-friendly fallback.

5. Add an "Enter cinematic mode" button that hides the toolbar, slowly
   auto-orbits the camera around the sun, and shows a subtle starfield
   particle background. Press Esc to exit.

Verify: visit /map/3d on a 1440p desktop monitor. The scene should feel
cinematic, run at a stable 60fps, and respond instantly to controls.
```

---

# Part B — Detailed tutorial

This section assumes no prior Three.js or react-three-fiber experience. It's written so you can follow it sequentially.

## B.1 Mental model

Three.js renders a **Scene** — a 3D world made of **Meshes** (geometry + material). A **Camera** looks into the scene; a **Renderer** draws the camera's view onto a `<canvas>` element each frame.

`react-three-fiber` is a React renderer that lets you describe the scene with JSX — `<mesh>`, `<sphereGeometry>`, `<meshStandardMaterial>` — and React reconciles those components into Three.js objects under the hood. You write components; you don't manage the scene graph by hand.

`@react-three/drei` is a sidecar library of pre-built helpers: orbit controls, HTML overlays, instanced meshes, useTexture, etc. We'll lean on it heavily.

`@react-three/postprocessing` adds visual effects (bloom = the "glow" around bright objects, vignette = darkened corners, depth-of-field = cinematic focus blur). These are most of the "wow" factor.

## B.2 What you start with

The 2D version at `app/(protected)/map/page.tsx` already does the hard work:

- Loads profiles, workflows, teams, intervention counts, metrics history from Supabase.
- Builds a clean `GalaxyData` shape ready for visualisation.

You'll **reuse** that data-loading logic. The only new code is the 3D rendering layer.

## B.3 Setup (Prompt 1, ~10 min)

```bash
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing
npm install -D @types/three
```

Files to create:

- `app/(protected)/map/3d/page.tsx` — server component, copies/imports the data-loading code from the 2D page.
- `app/(protected)/map/3d/_components/galaxy3d.tsx` — `"use client"` component with the `<Canvas>`.

Why a separate page: keeps the 2D map working as a stable fallback while you iterate on 3D. You'll only swap the nav link once 3D is solid.

Skeleton of `galaxy3d.tsx`:

```tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { GalaxyData } from "../../_components/galaxy";

export function Galaxy3D({ data }: { data: GalaxyData }) {
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 4, 12], fov: 55 }}>
        <color attach="background" args={["#05060d"]} />
        <ambientLight intensity={0.2} />
        <pointLight position={[0, 0, 0]} intensity={50} color="#ffd166" />
        <mesh>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="orange" emissive="orange" emissiveIntensity={1} />
        </mesh>
        <OrbitControls enableDamping />
      </Canvas>
    </div>
  );
}
```

After this step you have a single orange sun you can orbit with your mouse — proof the rendering pipeline is wired up. **Stop here, verify, then move on.**

## B.4 The company + team layer (Prompt 2, ~45 min)

A *useFrame* callback fires every frame. Use it to advance orbit angles. A *ref* to the team mesh lets you mutate its position without re-rendering React.

```tsx
function TeamPlanet({ team, index, total, headcount }: TeamPlanetProps) {
  const ref = useRef<Mesh>(null!);
  const orbitRadius = 6;
  const orbitSpeed = 0.05 + (index * 0.01);
  const phase = (index / total) * Math.PI * 2;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * orbitSpeed + phase;
    ref.current.position.x = Math.cos(t) * orbitRadius;
    ref.current.position.z = Math.sin(t) * orbitRadius;
  });

  const size = Math.min(0.9, 0.4 + headcount * 0.05);

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 24, 24]} />
      <meshStandardMaterial color="#94a3b8" emissive="#1e3a8a" emissiveIntensity={0.4} />
    </mesh>
  );
}
```

Then in `Galaxy3D`, render one `<TeamPlanet />` per team plus an orbit ring (`<ringGeometry>` rotated to lie flat).

**Why orbit on every frame instead of once on mount?** It makes the scene feel alive even when nothing is happening. Static dots are dead.

**Why `useRef` not `useState`?** Updating position 60 times per second through React state would re-render the tree 60 times. The ref mutates the underlying Three.js object directly with no React involvement.

## B.5 People moons with avatars (Prompt 3, ~1.5 h)

The hardest part of this step is the **avatar texture**. Dicebear returns an SVG, and Three.js's texture loader prefers raster formats.

### Approach 1 — convert SVG to canvas, then to Three.js texture

```tsx
async function svgUrlToTexture(url: string): Promise<Texture> {
  const res = await fetch(url);
  const svgText = await res.text();
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const blobUrl = URL.createObjectURL(blob);

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = blobUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, 256, 256);
  URL.revokeObjectURL(blobUrl);

  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
```

Wrap that in a `useEffect` that populates a `Map<personId, Texture>` and apply per-moon via a memoized hook.

### Approach 2 — use a real photo

If users start uploading actual JPG/PNG avatars to Supabase Storage, drei's `useTexture` works directly:

```tsx
const tex = useTexture(person.avatarUrl);
return (
  <mesh>
    <sphereGeometry args={[0.12, 16, 16]} />
    <meshStandardMaterial map={tex} />
  </mesh>
);
```

I recommend implementing both: prefer `useTexture` if the URL ends in a raster extension, fall back to the canvas-conversion path for SVGs.

### Orbit hierarchy

A moon orbits its team, which orbits the sun. The cleanest way is a **parented group**:

```tsx
<group ref={teamRef}>
  <TeamPlanet ... />
  {peopleOnTeam.map(p => <PersonMoon parentRef={teamRef} ... />)}
</group>
```

Then the team group's `useFrame` updates the team's orbit, and each moon updates its local position relative to the parent group. Three.js multiplies the matrices automatically.

## B.6 Workflow stars (Prompt 4, ~1.5 h)

Workflows are numerous (30–500+) and need to be cheap. Naive: one mesh per workflow → one draw call per workflow. With 200 workflows your frame rate halves.

**Solution: instanced rendering.** Drei's `<Instances>` lets you render N copies of the same geometry in a single draw call:

```tsx
import { Instances, Instance } from "@react-three/drei";

<Instances limit={500}>
  <sphereGeometry args={[0.06, 8, 8]} />
  <meshStandardMaterial />
  {workflows.map(w => (
    <Instance
      key={w.id}
      position={positionForWorkflow(w)}
      color={heatColor(w, heat)}
      scale={0.5 + w.frequencyPerWeek * 0.05}
    />
  ))}
</Instances>
```

For comet trails, use `<points>` with a custom buffer geometry. Generate ~30 points trailing the workflow position with decreasing alpha. Update the buffer each frame. Don't try to instance trails — there'll be few enough (one per workflow with active interventions) that direct rendering is fine.

## B.7 Hover, click, focus camera (Prompt 5, ~2 h)

`react-three-fiber` ships a built-in pointer-events system: `onPointerOver`, `onPointerOut`, `onClick` work on any mesh. Track hover/select state in React state at the `Galaxy3D` level.

For the camera fly-to, use drei's `<CameraControls>` (a more capable replacement for `<OrbitControls>`):

```tsx
const controls = useRef<CameraControlsImpl>(null!);

function focusOn(position: Vector3) {
  controls.current.setLookAt(
    position.x + 1, position.y + 1, position.z + 3,  // camera position
    position.x, position.y, position.z,              // target
    true,                                             // animate
  );
}
```

For edges to neighbours, drei's `<Line>` component takes an array of points and renders an antialiased line. On hover, compute the 1-hop neighbour set (you already wrote this for the 2D map — copy the helper) and render a `<Line>` per edge.

## B.8 Time scrubbing (Prompt 6, ~1 h of step 6)

The 2D map's `historyIndex` and `heatRange` data structures port directly. The trick in 3D is **smoothness**: rather than snapping to the new colour the moment the slider moves, animate it. Use `react-spring`'s `animated.meshStandardMaterial` and animate `emissiveIntensity` over a few hundred ms:

```tsx
import { useSpring, animated } from "@react-spring/three";

const { intensity } = useSpring({ intensity: heatValue ?? 0 });
return <animated.meshStandardMaterial emissiveIntensity={intensity} />;
```

For 200 workflows that's 200 springs, which is cheap. You can also drive the colour itself but it's harder to interpolate cleanly across an RGB scale; animating intensity tends to read better.

## B.9 Polish (rest of Prompt 6, ~1 h)

```tsx
import { EffectComposer, Bloom, Vignette, DepthOfField } from "@react-three/postprocessing";

<EffectComposer>
  <Bloom intensity={1.2} luminanceThreshold={0.4} />
  <Vignette offset={0.5} darkness={0.6} />
  {selectedId && <DepthOfField target={selectedPosition} focalLength={0.05} bokehScale={2} />}
</EffectComposer>
```

A few performance gotchas to test for:

- **Bloom is expensive.** If frame rate drops, reduce `mipmapBlur={true}` or lower the kernel.
- **Number of lights.** Each additional point/spot light recompiles shaders. Use one `<pointLight>` for the sun + a single `<ambientLight>`. Avoid per-team lights.
- **Texture memory.** 200 256×256 avatar textures = ~50MB GPU memory. Fine. 2000 = trouble.

## B.10 Timing summary

| Step | Prompt-mode (you supervise) | Tutorial-mode (you write) |
|------|-----------------------------|---------------------------|
| 1. Setup | 10 min | 10 min |
| 2. Sun + planets | 15–20 min | 45 min |
| 3. Avatar moons | 30 min | 1.5 h |
| 4. Workflow stars | 30 min | 1.5 h |
| 5. Interactions | 45 min | 2 h |
| 6. Polish | 30 min | 2 h |
| **Total** | **~2.5 h** | **~8 h** |

Add ~50% buffer for debugging and fiddling either way.

## B.11 Where the 3D version genuinely beats the 2D one

Don't switch unless these are worth the upgrade:

1. **Spatial intuition** — when there are 10+ teams, 2D layouts get crowded. 3D gives them more room and lets you orbit around the dense regions.
2. **Cinematic appeal** — for demos, all-hands, customer presentations, the 3D version is dramatically more impressive.
3. **Depth = importance** — you can place high-criticality workflows closer to the camera at rest, foregrounded against background noise.

Don't switch if your audience mostly uses this on laptops at 13" or on mobile — the 2D version reads better at small sizes.

## B.12 What to skip if you run short on time

If you have to cut, cut in this order:

1. Cinematic mode — pure decoration.
2. Depth-of-field — Bloom + Vignette already give 80% of the look.
3. Comet trails — gold ring around the star reads almost as well.
4. Time scrubbing — keep the snapshot view only.

Never cut: instanced rendering, hover/click, the camera fly-to. Without those it's a screensaver.
