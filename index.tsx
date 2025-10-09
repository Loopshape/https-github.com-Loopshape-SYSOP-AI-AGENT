import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GoogleGenAI, LiveSession, LiveServerMessage, Blob } from "@google/genai";

// --- AI Integration ---
const codeInputElement = document.getElementById('code-input') as HTMLTextAreaElement;
const analyzeButton = document.getElementById('analyze-btn') as HTMLButtonElement;
const suggestionOutputElement = document.getElementById('suggestion-output') as HTMLElement;
const audioButton = document.getElementById('audio-btn') as HTMLButtonElement;
const audioStatus = document.getElementById('audio-status') as HTMLDivElement;

let ai: GoogleGenAI | null = null;
try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    typeMessage("Error: Failed to initialize AI. API_KEY might be missing.");
}


async function analyzeCode() {
    if (!ai) {
        typeMessage("AI is not initialized. Please check your API key.");
        return;
    }

    const code = codeInputElement.value;
    if (!code.trim()) {
        typeMessage("Please enter some code to analyze.");
        return;
    }

    analyzeButton.disabled = true;
    analyzeButton.textContent = 'ANALYZING...';
    suggestionOutputElement.textContent = '';
    typeMessage("Analyzing code...\n\n");

    const prompt = `You are a world-class senior frontend engineer, codenamed AGENT NEMODIAN. Your purpose is to enhance developer productivity by providing intelligent assistance. A developer has provided the following code snippet. Analyze it carefully and provide concise, actionable suggestions for improvement. Focus on performance, readability, best practices, and potential bugs. Format your response clearly.

    Code to analyze:
    \`\`\`
    ${code}
    \`\`\`
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        typeMessage(response.text, true);

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        typeMessage("An error occurred while analyzing the code. Please check the console for details.");
    } finally {
        analyzeButton.disabled = false;
        analyzeButton.textContent = 'ANALYZE CODE';
    }
}

function typeMessage(message: string, isSuggestion = false) {
    let i = 0;
    const speed = 10; // milliseconds
    suggestionOutputElement.textContent = isSuggestion ? '' : message;
    
    if (!isSuggestion) return;

    function typeWriter() {
        if (i < message.length) {
            suggestionOutputElement.textContent += message.charAt(i);
            i++;
            suggestionOutputElement.parentElement!.scrollTop = suggestionOutputElement.parentElement!.scrollHeight;
            setTimeout(typeWriter, speed);
        }
    }
    typeWriter();
}


analyzeButton.addEventListener('click', analyzeCode);


// --- Dictation and Audio Visualization ---
let visualizerAudioContext: AudioContext | null = null;
let inputAudioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let isDictationActive = false;
let mediaStream: MediaStream | null = null;
let sessionPromise: Promise<LiveSession> | null = null;

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

async function toggleDictation() {
    if (isDictationActive) {
        // --- STOP DICTATION ---
        sessionPromise?.then(session => session.close());
        sessionPromise = null;
        mediaStream?.getTracks().forEach(track => track.stop());
        mediaStream = null;

        if (inputAudioContext && inputAudioContext.state !== 'closed') {
            await inputAudioContext.close();
            inputAudioContext = null;
        }
        if (visualizerAudioContext && visualizerAudioContext.state !== 'closed') {
            await visualizerAudioContext.suspend();
        }

        isDictationActive = false;
        audioButton.textContent = 'START DICTATION';
        audioButton.classList.remove('active');
        audioStatus.classList.remove('active');
        typeMessage("// Suggestions will appear here.");
    } else {
        // --- START DICTATION ---
        if (!ai) {
            typeMessage("AI is not initialized.");
            return;
        }
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Setup Visualizer
            if (!visualizerAudioContext) {
                visualizerAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const source = visualizerAudioContext.createMediaStreamSource(mediaStream);
                analyser = visualizerAudioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
            } else {
                const source = visualizerAudioContext.createMediaStreamSource(mediaStream);
                source.connect(analyser!);
            }
            await visualizerAudioContext.resume();

            // Setup Gemini Live Transcription
            inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

            sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContext!.createMediaStreamSource(mediaStream!);
                        const scriptProcessor = inputAudioContext!.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise!.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext!.destination);
                    },
                    onmessage: (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            if (text) {
                                codeInputElement.value += text;
                                codeInputElement.scrollTop = codeInputElement.scrollHeight;
                            }
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        typeMessage("Error: Dictation session failed.");
                        if (isDictationActive) toggleDictation();
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Live session closed');
                    },
                },
                config: {
                    inputAudioTranscription: {},
                },
            });
            
            isDictationActive = true;
            audioButton.textContent = 'STOP DICTATION';
            audioButton.classList.add('active');
            audioStatus.classList.add('active');
            typeMessage("// Listening... Speak to dictate code.");
            codeInputElement.focus();
        } catch (err) {
            console.error('Error starting dictation:', err);
            typeMessage("Error: Could not access microphone. Please grant permission.");
            mediaStream?.getTracks().forEach(track => track.stop());
            isDictationActive = false;
        }
    }
}

audioButton.addEventListener('click', toggleDictation);


// --- Three.js Scene Setup ---

// --- Mouse Tracking & State ---
const mouse = new THREE.Vector2();
let isZoomed = false;

window.addEventListener('mousemove', (event) => {
    // Prevent mouse from affecting background when interacting with AI panel
    if (event.clientX > window.innerWidth * 0.6) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// --- Scene & Camera ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = 50;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.prepend(renderer.domElement); // Prepend so it's behind the UI

// --- Post-processing (Bloom) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.4, 0.1);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- Starfield ---
const starVertices = [];
for (let i = 0; i < 15000; i++) {
    const x = (Math.random() - 0.5) * 2000;
    const y = (Math.random() - 0.5) * 2000;
    const z = (Math.random() - 0.5) * 2000;
    starVertices.push(x, y, z);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0x888888, size: 0.7 });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);


// --- Core Nucleus & Moebius Loop ---
const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x00ffff, // Changed to cyan
    metalness: 0.9,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    emissive: 0x00aaaa,
    emissiveIntensity: 1.5,
});

const nucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(4, 3), coreMaterial);
scene.add(nucleus);

const loop = new THREE.Mesh(new THREE.TorusKnotGeometry(10, 1.5, 200, 16, 2, 3), coreMaterial);
loop.scale.set(1.2, 1.2, 1.2);
scene.add(loop);

// --- Token Ions ---
const ION_COUNT = 2244;
const ionVertices = [];
const ionVelocities = [];
const ionGeometry = new THREE.BufferGeometry();
for (let i = 0; i < ION_COUNT; i++) {
    const x = (Math.random() - 0.5) * 100;
    const y = (Math.random() - 0.5) * 100;
    const z = (Math.random() - 0.5) * 100;
    ionVertices.push(x, y, z);
    ionVelocities.push({
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02
    });
}
ionGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ionVertices, 3));
ionGeometry.userData.velocities = ionVelocities;

const ionMaterial = new THREE.PointsMaterial({
    color: 0x00ffff,
    size: 0.3,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
});
const ions = new THREE.Points(ionGeometry, ionMaterial);
scene.add(ions);

// --- Molecule Class ---
class Molecule {
    group: THREE.Group;
    oxygen: THREE.Mesh;
    h1: THREE.Mesh;
    h2: THREE.Mesh;
    electrons: THREE.Mesh[];
    velocity: THREE.Vector3;

    constructor() {
        this.group = new THREE.Group();
        scene.add(this.group);
        const startPos = new THREE.Vector3((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50);
        this.group.position.copy(startPos);

        this.oxygen = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshPhysicalMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1, roughness: 0.2, metalness: 0.1 }));
        this.group.add(this.oxygen);

        this.h1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdddddd, roughness: 0.5 }));
        this.h1.position.set(1.5, 0.8, 0); this.group.add(this.h1);
        this.h2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdddddd, roughness: 0.5 }));
        this.h2.position.set(-1.5, 0.8, 0); this.group.add(this.h2);

        this.electrons = [];
        const numElectrons = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < numElectrons; i++) {
            const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), new THREE.MeshPhysicalMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 3, roughness: 0.1, metalness: 0.1 }));
            e.userData.radius = 2.5 + Math.random() * 2;
            e.userData.angle = Math.random() * Math.PI * 2;
            e.userData.speed = 0.01 + Math.random() * 0.02;
            e.userData.isFree = false;
            this.electrons.push(e);
            scene.add(e);
        }
        this.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03);
    }

    update(otherMolecules: Molecule[]) {
        this.group.position.add(this.velocity);

        if (Math.abs(this.group.position.x) > 60) this.velocity.x *= -1;
        if (Math.abs(this.group.position.y) > 40) this.velocity.y *= -1;
        if (Math.abs(this.group.position.z) > 40) this.velocity.z *= -1;

        otherMolecules.forEach(other => {
            if (other !== this) {
                const distance = this.group.position.distanceTo(other.group.position);
                if (distance < 5) {
                    const forceDir = new THREE.Vector3().subVectors(this.group.position, other.group.position).normalize();
                    this.velocity.add(forceDir.multiplyScalar(0.005));
                    other.velocity.sub(forceDir.multiplyScalar(0.005));
                }
            }
        });

        this.electrons.forEach(e => {
            if (!e.userData.isFree) {
                e.userData.angle += e.userData.speed;
                e.position.x = this.group.position.x + Math.cos(e.userData.angle) * e.userData.radius;
                e.position.z = this.group.position.z + Math.sin(e.userData.angle) * e.userData.radius;
                e.position.y = this.group.position.y + Math.sin(e.userData.angle * 2) * 0.5;
            } else {
                e.position.add(e.userData.velocity);
                const toCenter = new THREE.Vector3().subVectors(nucleus.position, e.position).normalize();
                e.userData.velocity.add(toCenter.multiplyScalar(0.002));
                e.userData.velocity.multiplyScalar(0.99);
            }
        });

        if (Math.random() < 0.0005 && this.electrons.length > 0) {
            const e = this.electrons[Math.floor(Math.random() * this.electrons.length)];
            if (!e.userData.isFree) {
                e.userData.isFree = true;
                e.userData.velocity = new THREE.Vector3().subVectors(e.position, this.group.position).normalize().multiplyScalar(0.2);
            }
        }
    }
}

const molecules = Array.from({ length: 12 }, () => new Molecule());

// --- Lights ---
scene.add(new THREE.AmbientLight(0xffffff, 0.2));
const lights: THREE.PointLight[] = [];
const lightColors = [0xff00ff, 0x00ffff, 0x00ff00];
for (let i = 0; i < 3; i++) {
    const pointLight = new THREE.PointLight(lightColors[i], 1.5, 150);
    pointLight.position.set(0, 0, 0);
    lights.push(pointLight);
    scene.add(pointLight);
}

// --- Animate ---
const clock = new THREE.Clock();
let frameCounter = 0;
// Higher number = more throttling. 1 = no throttling.
const PHYSICS_THROTTLE_RATE = 2; // Run physics at 30Hz on a 60Hz display
const RENDER_SKIP_RATE = 1;      // Render every frame. Increase to > 1 to skip rendering frames.

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // --- 1. Audio Data Acquisition (run once per frame) ---
    let normalizedAverage = 0;
    let highFreq = 0;
    if (isDictationActive && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);

        let total = 0;
        const halfLength = dataArray.length * 0.5;
        for (let i = 0; i < halfLength; i++) {
            total += dataArray[i];
        }
        const average = total / halfLength || 0; // Avoid division by zero
        normalizedAverage = average / 128;
        highFreq = dataArray[dataArray.length - 20] / 255;
    }

    // --- 2. Lightweight Visual Updates (run every frame for smoothness) ---
    // Update materials and effects based on audio or default values
    const reactiveIntensity = 1.5 + normalizedAverage * 2.0;
    (nucleus.material as THREE.MeshPhysicalMaterial).emissiveIntensity = reactiveIntensity;
    (loop.material as THREE.MeshPhysicalMaterial).emissiveIntensity = reactiveIntensity;
    bloomPass.strength = 0.7 + normalizedAverage * 0.5;
    ionMaterial.size = 0.3 + highFreq * 0.5;

    // Smooth camera interpolation
    const targetX = mouse.x * (isZoomed ? 2 : 10);
    const targetY = -mouse.y * (isZoomed ? 2 : 10);
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    // Simple, continuous rotations
    loop.rotation.x += 0.001;
    loop.rotation.y += 0.002;
    nucleus.rotation.y += 0.005;

    // Update light positions
    lights[0].position.x = Math.sin(elapsedTime * 0.5) * 25;
    lights[0].position.z = Math.cos(elapsedTime * 0.5) * 25;
    lights[1].position.y = Math.sin(elapsedTime * 0.7) * 25;
    lights[1].position.x = Math.cos(elapsedTime * 0.7) * 25;
    lights[2].position.z = Math.sin(elapsedTime * 0.9) * 25;
    lights[2].position.y = Math.cos(elapsedTime * 0.9) * 25;

    // --- 3. Throttled Physics (heavy lifting) ---
    if (frameCounter % PHYSICS_THROTTLE_RATE === 0) {
        // Molecule physics update
        molecules.forEach(m => {
            m.update(molecules);
            // Apply audio "kick" during physics tick
            if (normalizedAverage > 0.8) {
                 m.velocity.x += (Math.random() - 0.5) * 0.01 * normalizedAverage;
                 m.velocity.y += (Math.random() - 0.5) * 0.01 * normalizedAverage;
            }
        });

        // Ion physics update
        const positions = (ions.geometry.attributes.position as THREE.BufferAttribute).array as number[];
        const velocities = ionGeometry.userData.velocities;
        const mouseWorld = new THREE.Vector3(mouse.x * 30, mouse.y * 30, 0);

        for (let i = 0; i < ION_COUNT; i++) {
            const i3 = i * 3;
            const pos = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]);
            const vel = velocities[i];

            const toCenter = new THREE.Vector3().subVectors(nucleus.position, pos).normalize();
            vel.x += toCenter.x * 0.0005;
            vel.y += toCenter.y * 0.0005;
            vel.z += toCenter.z * 0.0005;

            const distToMouse = pos.distanceTo(mouseWorld);
            if (distToMouse < 15) {
                const fromMouse = new THREE.Vector3().subVectors(pos, mouseWorld).normalize();
                vel.x += fromMouse.x * 0.01;
                vel.y += fromMouse.y * 0.01;
            }

            vel.x *= 0.99; vel.y *= 0.99; vel.z *= 0.99;

            positions[i3] += vel.x;
            positions[i3 + 1] += vel.y;
            positions[i3 + 2] += vel.z;
        }
        (ions.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // --- 4. Frame-skipped Render ---
    if (frameCounter % RENDER_SKIP_RATE === 0) {
        composer.render(delta);
    }

    frameCounter++;
}


// --- Event Listeners ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}, false);

window.addEventListener('wheel', (event) => {
    const zoomSpeed = 0.1;
    camera.position.z += event.deltaY * zoomSpeed;
    camera.position.z = Math.max(15, Math.min(100, camera.position.z));
});

window.addEventListener('click', (event) => {
    // Prevent zoom toggle when clicking inside the AI panel
    const target = event.target as HTMLElement;
    if (target.closest('#ai-container')) {
        return;
    }

    isZoomed = !isZoomed;
    const targetZ = isZoomed ? 20 : 50;

    // A simple animation without GSAP
    const duration = 1500;
    const start = Date.now();
    const initialZ = camera.position.z;

    function animateZoom() {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 0.5 * (1 - Math.cos(Math.PI * progress)); // ease in-out
        camera.position.z = initialZ + (targetZ - initialZ) * ease;
        if (progress < 1) {
            requestAnimationFrame(animateZoom);
        }
    }
    animateZoom();
});

animate();