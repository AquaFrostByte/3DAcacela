let scene, camera, renderer, modelGroup, defaultGroup, customGroup;
let wireframeMaterial, edgeMaterial, hiddenMaterial;
let trackPoint;
let customSource = null;       // the loaded model, kept so the render style can be switched
let customTrack = null;        // where the HUD line points on an uploaded model
let modelStyle = 'wireframe';

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
let rotationSpeed = 0.04;
let baseIdleRotation = 0.002;

const FIT_SIZE = 8; // longest side of any uploaded model, in scene units

function initThreeJS() {
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.03);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 11);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // lights only matter for the "Original materials" render style
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(5, 8, 10);
    scene.add(sun);

    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    defaultGroup = new THREE.Group();
    modelGroup.add(defaultGroup);
    customGroup = new THREE.Group();
    modelGroup.add(customGroup);

    const rootStyles = getComputedStyle(document.documentElement);
    const initialColor = rootStyles.getPropertyValue('--theme-color').trim();

    wireframeMaterial = new THREE.MeshBasicMaterial({
        color: initialColor,
        wireframe: true,
        transparent: true,
        opacity: 0.9,
        wireframeLinewidth: 1.5
    });
    edgeMaterial = new THREE.LineBasicMaterial({ color: initialColor, transparent: true, opacity: 0.95 });
    hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false });

    const hubGeo = new THREE.SphereGeometry(1.8, 16, 12);
    const hub = new THREE.Mesh(hubGeo, wireframeMaterial);
    defaultGroup.add(hub);

    const bodyGeo = new THREE.CylinderGeometry(1.5, 1.5, 7, 16);
    const body = new THREE.Mesh(bodyGeo, wireframeMaterial);
    body.rotation.z = Math.PI / 2;
    defaultGroup.add(body);

    const capGeo = new THREE.CylinderGeometry(1.0, 1.8, 1.2, 12);

    const capLeft = new THREE.Mesh(capGeo, wireframeMaterial);
    capLeft.position.x = -4.1;
    capLeft.rotation.z = Math.PI / 2;
    defaultGroup.add(capLeft);

    const capRight = new THREE.Mesh(capGeo, wireframeMaterial);
    capRight.position.x = 4.1;
    capRight.rotation.z = -Math.PI / 2;
    defaultGroup.add(capRight);

    const ring1Geo = new THREE.TorusGeometry(3.0, 0.05, 8, 32);
    const ring1 = new THREE.Mesh(ring1Geo, wireframeMaterial);
    ring1.rotation.x = Math.PI / 3;
    defaultGroup.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(4.0, 0.05, 8, 32);
    const ring2 = new THREE.Mesh(ring2Geo, wireframeMaterial);
    ring2.rotation.y = Math.PI / 4;
    defaultGroup.add(ring2);

    const spikeGeo = new THREE.CylinderGeometry(0.04, 0.15, 2.5, 8);

    for (let i = -2.5; i <= 2.5; i += 1.25) {
        const sTop = new THREE.Mesh(spikeGeo, wireframeMaterial);
        sTop.position.set(i, 2.0, 0);
        defaultGroup.add(sTop);
        const sBot = new THREE.Mesh(spikeGeo, wireframeMaterial);
        sBot.position.set(i, -2.0, 0);
        sBot.rotation.z = Math.PI;
        defaultGroup.add(sBot);
    }

    trackPoint = new THREE.Object3D();
    trackPoint.position.set(0, 1.5, 1.5);
    modelGroup.add(trackPoint);

    modelGroup.rotation.x = 0.4;
    modelGroup.rotation.y = -0.5;

    window.addEventListener('resize', onWindowResize, false);
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ---------- model upload ---------- */

function setStatus(text, isError) {
    const el = document.getElementById('model-status');
    el.textContent = text;
    el.classList.toggle('error', !!isError);
}

function disposeObject(obj) {
    obj.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.userData && o.userData.orig) {
            const mats = Array.isArray(o.userData.orig) ? o.userData.orig : [o.userData.orig];
            mats.forEach((m) => m.dispose && m.dispose());
        }
    });
}

function clearCustom() {
    while (customGroup.children.length) {
        const c = customGroup.children[0];
        customGroup.remove(c);
        disposeObject(c);
    }
    customSource = null;
    customTrack = null;
}

function applyModelStyle() {
    if (!customSource) return;
    customSource.traverse((o) => {
        if (!o.isMesh || !o.userData.orig) return;
        if (modelStyle === 'original') {
            o.material = o.userData.orig;
            if (o.userData.edges) o.userData.edges.visible = false;
        } else if (modelStyle === 'edges') {
            o.material = hiddenMaterial;
            if (o.userData.edges) o.userData.edges.visible = true;
        } else {
            o.material = wireframeMaterial;
            if (o.userData.edges) o.userData.edges.visible = false;
        }
    });
}

function showCustom(object, label) {
    clearCustom();

    let tris = 0;
    const meshes = [];
    object.traverse((o) => { if (o.isMesh) meshes.push(o); });
    if (!meshes.length) {
        setStatus('No meshes found in that file.', true);
        return;
    }
    meshes.forEach((m) => {
        m.userData.orig = m.material || new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
        if (!m.geometry.attributes.normal && m.userData.orig.isMeshStandardMaterial === undefined) {
            m.geometry.computeVertexNormals();
        }
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), edgeMaterial);
        edges.visible = false;
        m.add(edges);
        m.userData.edges = edges;
        const idx = m.geometry.index;
        tris += idx ? idx.count / 3 : m.geometry.attributes.position.count / 3;
    });

    // center the model and scale it to a known size
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    object.position.sub(center);

    const wrapper = new THREE.Group();
    wrapper.add(object);
    const k = FIT_SIZE / maxDim;
    wrapper.scale.setScalar(k);
    customGroup.add(wrapper);

    customSource = object;
    customTrack = new THREE.Vector3(0, size.y * k * 0.3, size.z * k * 0.3);
    trackPoint.position.copy(customTrack);

    defaultGroup.visible = false;
    applyModelStyle();
    setStatus(label + ' loaded. ' + Math.round(tris).toLocaleString() + ' triangles.', false);
}

function showDefault() {
    clearCustom();
    defaultGroup.visible = true;
    trackPoint.position.set(0, 1.5, 1.5);
    setStatus('Showing built-in nano mechanism.', false);
}

function loadModelFile(file) {
    if (!file) return;
    const name = file.name;
    const ext = name.split('.').pop().toLowerCase();
    if (['glb', 'gltf', 'obj', 'stl'].indexOf(ext) === -1) {
        setStatus('Unsupported file type ".' + ext + '". Use .glb, .gltf, .obj or .stl.', true);
        return;
    }
    setStatus('Reading ' + name + '...', false);

    const reader = new FileReader();
    reader.onerror = () => setStatus('Could not read ' + name + '.', true);
    reader.onload = () => {
        const buf = reader.result;
        try {
            if (ext === 'glb' || ext === 'gltf') {
                new THREE.GLTFLoader().parse(buf, '', (gltf) => {
                    showCustom(gltf.scene, name);
                }, (err) => {
                    setStatus('Could not parse ' + name + '. A .gltf with separate .bin or texture files will not load, use a single .glb instead.', true);
                });
            } else if (ext === 'obj') {
                const text = new TextDecoder().decode(buf);
                showCustom(new THREE.OBJLoader().parse(text), name);
            } else {
                const geo = new THREE.STLLoader().parse(buf);
                geo.computeVertexNormals();
                const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xbfc7cc, metalness: 0.2, roughness: 0.6 }));
                const g = new THREE.Group();
                g.add(mesh);
                showCustom(g, name);
            }
        } catch (e) {
            setStatus('Could not parse ' + name + '.', true);
        }
    };
    reader.readAsArrayBuffer(file);
}

/* ---------- input ---------- */

document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = true;
        if (!/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) e.preventDefault();
    }
    if (e.key === 'Escape') {
        document.getElementById('settings-menu').classList.toggle('active');
    }
});

document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = false;
    }
});

function animate() {
    requestAnimationFrame(animate);

    let isManualMoving = false;
    if (keys.ArrowUp) { modelGroup.rotation.x -= rotationSpeed; isManualMoving = true; }
    if (keys.ArrowDown) { modelGroup.rotation.x += rotationSpeed; isManualMoving = true; }
    if (keys.ArrowLeft) { modelGroup.rotation.y -= rotationSpeed; isManualMoving = true; }
    if (keys.ArrowRight) { modelGroup.rotation.y += rotationSpeed; isManualMoving = true; }

    if (!isManualMoving && pointers.size === 0) {
        modelGroup.rotation.x += baseIdleRotation * 0.5;
        modelGroup.rotation.y += baseIdleRotation;
        modelGroup.rotation.z += baseIdleRotation * 0.2;
    }

    renderer.render(scene, camera);
    updateDynamicLine();
}

const _tmpVec = new THREE.Vector3();
function updateDynamicLine() {
    if (!trackPoint) return;

    trackPoint.getWorldPosition(_tmpVec);

    _tmpVec.project(camera);
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;
    const targetX = (_tmpVec.x * widthHalf) + widthHalf;
    const targetY = -(_tmpVec.y * heightHalf) + heightHalf;

    const anchorDot = document.getElementById('anchor-dot');
    const rect = anchorDot.getBoundingClientRect();
    const startX = rect.left + (rect.width / 2);
    const startY = rect.top + (rect.height / 2);

    const line = document.getElementById('dynamic-line');
    line.setAttribute('x1', startX);
    line.setAttribute('y1', startY);
    line.setAttribute('x2', targetX);
    line.setAttribute('y2', targetY);
}

const panel = document.getElementById('right-panel');
let isDragging = false, dragStartX, dragStartY, initialLeft, initialTop;

panel.addEventListener('mousedown', (e) => {
    if (document.body.classList.contains('layout-floating') && !e.target.closest('input, textarea, select, .panel-inner')) {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        const rect = panel.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.left = initialLeft + 'px';
        panel.style.top = initialTop + 'px';
        panel.style.transition = 'none';

        e.preventDefault();
    }
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    panel.style.left = (initialLeft + dx) + 'px';
    panel.style.top = (initialTop + dy) + 'px';
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        panel.style.transition = 'all 0.3s ease';
    }
});

// drag and drop a model file anywhere on the page
document.addEventListener('dragover', (e) => { e.preventDefault(); });
document.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadModelFile(f);
});

/* ---------- mouse / touch: drag to rotate, right-drag or shift-drag to move, wheel or pinch to zoom ---------- */

const pointers = new Map();
let dragMode = 'rotate';
let pinchStart = 0, pinchScale = 1;

function setScale(s) {
    s = Math.min(3, Math.max(0.2, s));
    modelGroup.scale.setScalar(s);
    const slider = document.getElementById('range-scale');
    if (slider) slider.value = s;
}

function resetView() {
    modelGroup.position.set(0, 0, 0);
    setScale(1);
}

function initPointerControls() {
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('pointerdown', (e) => {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        dragMode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rotate';
        document.body.classList.add('grabbing');
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
            pinchScale = modelGroup.scale.x;
        }
    });

    el.addEventListener('pointermove', (e) => {
        const p = pointers.get(e.pointerId);
        if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;

        if (pointers.size >= 2) {
            const [a, b] = [...pointers.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinchStart > 0) setScale(pinchScale * d / pinchStart);
        } else if (dragMode === 'pan') {
            const perPx = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / window.innerHeight;
            modelGroup.position.x += dx * perPx;
            modelGroup.position.y -= dy * perPx;
        } else {
            modelGroup.rotation.y += dx * 0.01;
            modelGroup.rotation.x += dy * 0.01;
        }
    });

    const end = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size === 0) document.body.classList.remove('grabbing');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    el.addEventListener('wheel', (e) => {
        e.preventDefault();
        setScale(modelGroup.scale.x * Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    el.addEventListener('dblclick', resetView);
}

function boot() {
    document.body.classList.add('layout-docked');
    initThreeJS();
    initPointerControls();

    document.getElementById('layout-selector').addEventListener('change', (e) => {
        if (e.target.value === 'floating') {
            document.body.classList.add('layout-floating');
            document.body.classList.remove('layout-docked');
            panel.style.left = 'auto';
            panel.style.right = '2rem';
            panel.style.top = '2rem';
            panel.style.bottom = 'auto';
        } else {
            document.body.classList.remove('layout-floating');
            document.body.classList.add('layout-docked');
            panel.style.left = '';
            panel.style.right = '';
            panel.style.top = '';
            panel.style.bottom = '';
        }
    });

    document.getElementById('theme-selector').addEventListener('change', (e) => {
        const newColor = e.target.value;
        document.documentElement.style.setProperty('--theme-color', newColor);

        const r = parseInt(newColor.slice(1, 3), 16);
        const g = parseInt(newColor.slice(3, 5), 16);
        const b = parseInt(newColor.slice(5, 7), 16);
        document.documentElement.style.setProperty('--grid-color', `rgba(${r}, ${g}, ${b}, 0.15)`);

        if (wireframeMaterial) {
            wireframeMaterial.color.setHex(parseInt(newColor.replace('#', '0x')));
            edgeMaterial.color.setHex(parseInt(newColor.replace('#', '0x')));
        }
    });

    document.getElementById('input-title').addEventListener('input', (e) => {
        document.getElementById('display-title').innerText = e.target.value;
    });

    document.getElementById('input-stats').addEventListener('input', (e) => {
        document.getElementById('display-stats').innerText = e.target.value;
    });

    document.getElementById('range-speed').addEventListener('input', (e) => {
        rotationSpeed = parseFloat(e.target.value);
    });

    document.getElementById('range-scanline').addEventListener('input', (e) => {
        document.documentElement.style.setProperty('--scanline-opacity', e.target.value);
    });

    document.getElementById('model-file').addEventListener('change', (e) => {
        loadModelFile(e.target.files[0]);
    });

    document.getElementById('model-reset').addEventListener('click', () => {
        document.getElementById('model-file').value = '';
        showDefault();
    });

    document.getElementById('model-style').addEventListener('change', (e) => {
        modelStyle = e.target.value;
        applyModelStyle();
    });

    document.getElementById('range-scale').addEventListener('input', (e) => {
        setScale(parseFloat(e.target.value));
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
