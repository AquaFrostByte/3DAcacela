let scene, camera, renderer, modelGroup;
let wireframeMaterial;
let trackPoint;

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
let rotationSpeed = 0.04;
let baseIdleRotation = 0.002;

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

    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const rootStyles = getComputedStyle(document.documentElement);
    const initialColor = rootStyles.getPropertyValue('--theme-color').trim();

    wireframeMaterial = new THREE.MeshBasicMaterial({ 
        color: initialColor, 
        wireframe: true,
        transparent: true,
        opacity: 0.9,
        wireframeLinewidth: 1.5
    });

    const hubGeo = new THREE.SphereGeometry(1.8, 16, 12);
    const hub = new THREE.Mesh(hubGeo, wireframeMaterial);
    modelGroup.add(hub);

    const bodyGeo = new THREE.CylinderGeometry(1.5, 1.5, 7, 16);
    const body = new THREE.Mesh(bodyGeo, wireframeMaterial);
    body.rotation.z = Math.PI / 2;
    modelGroup.add(body);

    const capGeo = new THREE.CylinderGeometry(1.0, 1.8, 1.2, 12);
            
    const capLeft = new THREE.Mesh(capGeo, wireframeMaterial);
    capLeft.position.x = -4.1;
    capLeft.rotation.z = Math.PI / 2;
    modelGroup.add(capLeft);

    const capRight = new THREE.Mesh(capGeo, wireframeMaterial);
    capRight.position.x = 4.1;
    capRight.rotation.z = -Math.PI / 2;
    modelGroup.add(capRight);

    const ring1Geo = new THREE.TorusGeometry(3.0, 0.05, 8, 32);
    const ring1 = new THREE.Mesh(ring1Geo, wireframeMaterial);
    ring1.rotation.x = Math.PI / 3;
    modelGroup.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(4.0, 0.05, 8, 32);
    const ring2 = new THREE.Mesh(ring2Geo, wireframeMaterial);
    ring2.rotation.y = Math.PI / 4;
    modelGroup.add(ring2);

    const spikeGeo = new THREE.CylinderGeometry(0.04, 0.15, 2.5, 8);
    
    for(let i = -2.5; i <= 2.5; i+=1.25) {
        const sTop = new THREE.Mesh(spikeGeo, wireframeMaterial);
        sTop.position.set(i, 2.0, 0);
        modelGroup.add(sTop)
        const sBot = new THREE.Mesh(spikeGeo, wireframeMaterial);
        sBot.position.set(i, -2.0, 0);
        sBot.rotation.z = Math.PI;
        modelGroup.add(sBot);
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
    camera.updateProjectMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = true;
        e.preventDefault();
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
        
    if (!isManualMoving) {
        modelGroup.rotation.x += baseIdleRotation * 0.5;
        modelGroup.rotation.y += baseIdleRotation;
        modelGroup.rotation.z += baseIdleRotation * 0.2;
    }

    renderer.render(scene, camera);
    updateDynamicLine();
}

function updateDynamicLine() {
    if (!trackPoint) return

    const vector = new THREE.Vector3();
    trackPoint.getWorldPosition(vector);

    vector.project(camera);
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;
    const targetX = (vector.x * widthHalf) + widthHalf;
    const targetY = -(vector.y * heightHalf) + heightHalf

    const anchorDot = document.getElementById('anchor-dot');
    const rect = anchorDot.getBoundingClientRect();
    const startX = rect.left + (rect.width / 2);
    const startY = rect.top + (rect.height / 2)

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

document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();

    document.getElementById('layout-selector').addEventListener('change', (e) => {
        if(e.target.value === 'floating') {
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
    })

    document.getElementById('theme-selector').addEventListener('change', (e) => {
        const newColor = e.target.value;
        document.documentElement.style.setProperty('--theme-color', newColor);
                
        const r = parseInt(newColor.slice(1, 3), 16);
        const g = parseInt(newColor.slice(3, 5), 16);
        const b = parseInt(newColor.slice(5, 7), 16);
        document.documentElement.style.setProperty('--grid-color', `rgba(${r}, ${g}, ${b}, 0.15)`);

        if (wireframeMaterial) {
            wireframeMaterial.color.setHex(parseInt(newColor.replace('#', '0x')));
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
});