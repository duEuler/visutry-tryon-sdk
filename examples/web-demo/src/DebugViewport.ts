import * as THREE from "three";
import type { GlassesAssetManifest, NormalizedFaceResult } from "@visutry/tryon-core";

export type DebugViewportView = "front" | "top" | "left" | "right";
type DebugPose = { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number } };

/** Lightweight inspection viewport; it never participates in try-on rendering. */
export class DebugViewport {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly root = new THREE.Group();
  private view: DebugViewportView = "front";
  private resizeObserver?: ResizeObserver;

  constructor(private readonly canvas: HTMLCanvasElement, view: DebugViewportView = "front") {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.camera = new THREE.OrthographicCamera(-1.6, 1.6, 1.4, -1.4, 0.1, 20);
    this.scene.add(this.root);
    this.scene.add(new THREE.AxesHelper(1.15));
    this.resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => this.resize());
    this.resizeObserver?.observe(canvas);
    this.resize();
    this.setView(view);
  }

  setView(view: DebugViewportView): void {
    this.view = view;
    const locations: Record<DebugViewportView, [number, number, number]> = {
      front: [0, 0, 5],
      top: [0, 5, 0],
      left: [-5, 0, 0],
      right: [5, 0, 0],
    };
    this.camera.position.set(...locations[view]);
    this.camera.lookAt(0, 0, 0);
    this.render();
  }

  update(face: NormalizedFaceResult | null, pose: DebugPose | null, asset: GlassesAssetManifest): void {
    this.root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else if (material) material.dispose();
    });
    this.root.clear();
    if (face) {
      const positions = new Float32Array(face.landmarks.normalized.flatMap((point) => [
        (point.x - 0.5) * 2.2,
        -(point.y - 0.5) * 2.2,
        -point.z * 2.2,
      ]));
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      this.root.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x35d0ff, size: 0.025 })),
      );
      const box = new THREE.BoxGeometry(face.bbox.width * 2.2, face.bbox.height * 2.2, 0.35);
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x4a9eff }));
      wire.position.set((face.bbox.x + face.bbox.width / 2 - 0.5) * 2.2, -(face.bbox.y + face.bbox.height / 2 - 0.5) * 2.2, 0);
      this.root.add(wire);
    }
    if (pose) {
      const frameWidth = Math.max(0.8, Math.min(2.2, (asset.dimensions.frameWidthMm / 150) * pose.scale.x * 3));
      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(frameWidth, frameWidth * 0.42, 0.18)),
        new THREE.LineBasicMaterial({ color: 0xffbd4a }),
      );
      frame.position.set(pose.position.x, pose.position.y, pose.position.z);
      frame.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
      this.root.add(frame);
      const anchors = asset.anchors;
      if (anchors?.leftLensCenter && anchors.rightLensCenter) {
        const points = new THREE.Vector3();
        const geometry = new THREE.BufferGeometry().setFromPoints([
          points.set(pose.position.x - frameWidth * 0.22, pose.position.y, pose.position.z),
          points.set(pose.position.x + frameWidth * 0.22, pose.position.y, pose.position.z),
        ]);
        this.root.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x35d07f })));
      }
    }
    this.render();
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth || 280);
    const height = Math.max(1, this.canvas.clientHeight || 190);
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.left = -1.6 * aspect;
    this.camera.right = 1.6 * aspect;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
