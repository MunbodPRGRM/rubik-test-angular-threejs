import { Injectable, ElementRef, NgZone } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { TrackballControls } from 'three/examples/jsm/Addons.js';
import gsap from 'gsap';
import { RoundedBoxGeometry } from 'three/examples/jsm/Addons.js';

@Injectable({
  providedIn: 'root',
})
export class Engine {
  private canvas!: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  // private controls!: OrbitControls;
  private controls!: TrackballControls;
  
  // เก็บก้อนรูบิกทั้งหมดไว้ใน Group เดียวกันก่อน
  public cubeGroup = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  private isAnimating = false;
  private isDragging = false;
  private dragStartMouse = new THREE.Vector2(); // เก็บจุดที่เริ่มคลิก
  private intersectData: any = null;            // เก็บข้อมูลชิ้นที่โดนคลิกและด้านที่โดนคลิก

  constructor(private ngZone: NgZone) {}

  public createScene(canvas: ElementRef<HTMLCanvasElement>): void {
    // 1. ตั้งค่า Canvas และ Renderer
    this.canvas = canvas.nativeElement;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // 2. สร้าง Scene และสีพื้นหลัง
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    // 3. ตั้งค่ากล้อง (Camera)
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(6, 5, 7); // ขยับกล้องออกเฉียงๆ ให้เห็นเป็นมิติ
    this.camera.lookAt(0, 0, 0);

    // 4. เพิ่ม Group ลงใน Scene และสร้างรูบิก
    this.scene.add(this.cubeGroup);
    this.buildRubik();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // --- ตั้งค่า TrackballControls สำหรับการหมุนแบบอิสระ ---
    this.controls = new TrackballControls(this.camera, this.renderer.domElement);
    this.controls.rotateSpeed = 3.0; // ความไวในการหมุนกล้อง (ปรับลด/เพิ่มได้)
    this.controls.zoomSpeed = 1.2;   // ความไวในการซูม
    this.controls.noPan = true;      // ปิดการคลิกขวาเพื่อเลื่อนกล้องออกนอกศูนย์กลาง
    this.controls.staticMoving = false; // เปิดใช้ความหน่วง (Damping)
    this.controls.dynamicDampingFactor = 0.1; // ระดับความสมูทเวลาปล่อยเมาส์

    window.addEventListener('resize', () => this.onWindowResize());

    this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    this.canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));

    // 5. เริ่มลูปเรนเดอร์
    this.animate();
  }

  private buildRubik(): void {
    // 1. เปลี่ยนสีให้ดูโมเดิร์นขึ้นนิดหน่อย (สีสดแต่อมพาสเทลนิดๆ จะสวยมาก)
    const colors = [
      0xb71234, // ขวา (แดงเข้ม)
      0xff5800, // ซ้าย (ส้ม)
      0xffffff, // บน (ขาว)
      0xffd500, // ล่าง (เหลือง)
      0x009b48, // หน้า (เขียว)
      0x0046ad  // หลัง (น้ำเงิน)
    ];

    // 2. เปลี่ยนเป็น MeshStandardMaterial เพื่อให้รับแสงและดูเป็นพลาสติกเงางาม
    const materials = colors.map(color => new THREE.MeshStandardMaterial({ 
      color: color,
      roughness: 0.1, // ค่ายิ่งน้อย ยิ่งเงา (พลาสติกมันวาว)
      metalness: 0.1  // ให้ความรู้สึกแข็งแรงนิดๆ
    }));

    const size = 0.96;   // หดชิ้นส่วนให้เล็กลงนิดเดียว เพื่อเว้นร่องสีดำ
    const spacing = 1.0; // ขยับให้แกนกลางชิดกันพอดี (ไม่มีช่องว่างอากาศแล้ว)
    const radius = 0.08; // ความโค้งมนของขอบชิ้นส่วน

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          
          // 3. สร้างก้อนพลาสติก "สีดำ" เป็นแกนใน (ช่วยทำให้ร่องระหว่างรูบิกดูเป็นสีดำสมจริง)
          const blackInnerGeo = new RoundedBoxGeometry(size, size, size, 4, radius);
          const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
          const cubie = new THREE.Mesh(blackInnerGeo, blackMaterial);

          // 4. สร้าง "สติกเกอร์สี" แปะทับหน้าก้อนสีดำอีกที
          // เราใช้ PlaneGeometry แปะเข้าไปทั้ง 6 ด้าน เพื่อให้ดูเหมือนรูบิกของแท้
          const stickerSize = size - 0.1; // สติกเกอร์ต้องเล็กกว่าชิ้นพลาสติกนิดนึง
          const stickerGeo = new THREE.PlaneGeometry(stickerSize, stickerSize);
          const offset = size / 2 + 0.001; // ระยะขยับสติกเกอร์ออกมาแปะที่ผิว

          // สร้างและแปะสติกเกอร์ทีละหน้า
          const faces = [
            { mat: materials[0], pos: [offset, 0, 0], rot: [0, Math.PI / 2, 0] },   // ขวา
            { mat: materials[1], pos: [-offset, 0, 0], rot: [0, -Math.PI / 2, 0] }, // ซ้าย
            { mat: materials[2], pos: [0, offset, 0], rot: [-Math.PI / 2, 0, 0] },  // บน
            { mat: materials[3], pos: [0, -offset, 0], rot: [Math.PI / 2, 0, 0] },  // ล่าง
            { mat: materials[4], pos: [0, 0, offset], rot: [0, 0, 0] },             // หน้า
            { mat: materials[5], pos: [0, 0, -offset], rot: [0, Math.PI, 0] }       // หลัง
          ];

          // เช็คว่าชิ้นนี้อยู่ขอบด้านไหน ก็แปะสติกเกอร์แค่ด้านนั้น
          faces.forEach((face, index) => {
            if ((index === 0 && x === 1) || 
                (index === 1 && x === -1) || 
                (index === 2 && y === 1) || 
                (index === 3 && y === -1) || 
                (index === 4 && z === 1) || 
                (index === 5 && z === -1)) {
              const sticker = new THREE.Mesh(stickerGeo, face.mat);
              sticker.position.set(face.pos[0], face.pos[1], face.pos[2]);
              sticker.rotation.set(face.rot[0], face.rot[1], face.rot[2]);
              cubie.add(sticker);
            }
          });

          // เก็บพิกัดตั้งต้นไว้
          cubie.userData = { initialPosition: new THREE.Vector3(x, y, z) };
          cubie.position.set(x * spacing, y * spacing, z * spacing);
          
          this.cubeGroup.add(cubie);
        }
      }
    }
  }

  private animate(): void {
    this.ngZone.runOutsideAngular(() => {
      const renderLoop = () => {
        requestAnimationFrame(renderLoop);
        
        // 5. อัปเดต Controls ทุกเฟรม (จำเป็นมากเมื่อตั้งค่า enableDamping = true)
        this.controls.update(); 
        
        this.renderer.render(this.scene, this.camera);
      };
      renderLoop();
    });
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    
    // สิ่งที่ต้องเพิ่มสำหรับ TrackballControls
    this.controls.handleResize();
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.isAnimating) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.cubeGroup.children, false);

    if (intersects.length > 0) {
      // 1. ปิด OrbitControls ชั่วคราว เพื่อไม่ให้กล้องหมุนตามเวลาเราลากรูบิก
      this.controls.enabled = false; 
      this.isDragging = true;
      
      // 2. จำตำแหน่งเมาส์เริ่มต้นบนหน้าจอ (ใช้ pixel จริงๆ เพื่อหาระยะลากได้ง่าย)
      this.dragStartMouse.set(event.clientX, event.clientY);

      // 3. จำชิ้นส่วนที่คลิกโดน และทิศทางหน้าตัด (Normal) ที่คลิกโดนในโลก 3 มิติ
      const faceNormal = intersects[0].face!.normal.clone();
      // แปลง Normal จากพิกัดชิ้นส่วนให้เป็นพิกัดโลก (World Space) สำคัญมากเมื่อชิ้นส่วนเคยถูกหมุนไปแล้ว
      faceNormal.transformDirection(intersects[0].object.matrixWorld).round();

      this.intersectData = {
        cubie: intersects[0].object as THREE.Mesh,
        normal: faceNormal
      };
    }
  }

  private onPointerUp(event: PointerEvent): void {
    // เปิด OrbitControls กลับมาเสมอ
    this.controls.enabled = true;

    if (!this.isDragging || !this.intersectData) return;
    this.isDragging = false;

    const deltaX = event.clientX - this.dragStartMouse.x;
    const deltaY = event.clientY - this.dragStartMouse.y;

    // ถ้าระยะลากน้อยกว่า 15 pixel ถือว่าไม่ได้ลาก
    if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) return;

    const { cubie, normal } = this.intersectData;

    // 1. หา "ทิศทางการลากในโลก 3 มิติ" โดยอิงจากมุมกล้องปัจจุบัน
    // ดึงเวกเตอร์แกน X (ขวา) และ Y (บน) ของกล้องออกมา
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

    // สร้างเวกเตอร์ทิศทางที่เราลากเมาส์ (สังเกตว่า deltaY ต้องติดลบ เพราะแกน Y หน้าจอกับ 3D สวนทางกัน)
    const dragVector3D = camRight.multiplyScalar(deltaX).add(camUp.multiplyScalar(-deltaY)).normalize();

    // 2. ใช้ท่าไม้ตาย Cross Product ระหว่าง "หน้าปกติที่คลิก (Normal)" กับ "ทิศทางที่ลาก (Drag)"
    // ผลลัพธ์ที่ได้จะเป็นเวกเตอร์ "แกนหมุน (Rotation Axis)" ที่ถูกต้อง 100% ทันที
    const rotationAxisVector = normal.clone().cross(dragVector3D);

    // 3. ดูว่าแกนหมุนที่คำนวณได้ มันตรงกับแกน X, Y หรือ Z มากที่สุด
    let rotateAxis: 'x' | 'y' | 'z' = 'x';
    let maxVal = Math.abs(rotationAxisVector.x);

    if (Math.abs(rotationAxisVector.y) > maxVal) {
      maxVal = Math.abs(rotationAxisVector.y);
      rotateAxis = 'y';
    }
    if (Math.abs(rotationAxisVector.z) > maxVal) {
      maxVal = Math.abs(rotationAxisVector.z);
      rotateAxis = 'z';
    }

    // 4. หาทิศทางการหมุน (บวก หรือ ลบ 90 องศา)
    // Math.sign จะคืนค่า 1 (ตาม) หรือ -1 (ทวน) ตามแกนหลักที่เราหามาได้
    const direction = Math.sign(rotationAxisVector[rotateAxis]);
    const angle = (Math.PI / 2) * direction;

    // ดึงพิกัดเพื่อบอกว่าหมุนแถวไหน
    const rotateCoordinate = cubie.position[rotateAxis];
    
    // สั่งหมุน!
    this.rotateLayer(rotateAxis, rotateCoordinate, angle);
    
    this.intersectData = null;
  }

  public rotateLayer(axis: 'x' | 'y' | 'z', coordinate: number, angle: number, duration: number = 0.5): Promise<void> {
    return new Promise((resolve) => {
      this.isAnimating = true;

      const epsilon = 0.1;
      const activeCubies: THREE.Mesh[] = [];
      
      this.cubeGroup.children.forEach((child) => {
        if (Math.abs(child.position[axis] - coordinate) < epsilon) {
          activeCubies.push(child as THREE.Mesh);
        }
      });

      const pivot = new THREE.Group();
      this.scene.add(pivot);

      activeCubies.forEach(cubie => {
        pivot.attach(cubie);
      });

      const startRotation = pivot.rotation[axis];
      const targetRotation = startRotation + angle;
      const animObj = { value: startRotation };

      gsap.to(animObj, {
        value: targetRotation,
        duration: duration, // ใช้ความเร็วที่ส่งเข้ามา
        ease: "power2.inOut",
        onUpdate: () => {
          pivot.rotation[axis] = animObj.value;
        },
        onComplete: () => {
          activeCubies.forEach(cubie => {
            this.cubeGroup.attach(cubie);
            cubie.position.x = Math.round(cubie.position.x * 100) / 100;
            cubie.position.y = Math.round(cubie.position.y * 100) / 100;
            cubie.position.z = Math.round(cubie.position.z * 100) / 100;
          });
          this.scene.remove(pivot);
          this.isAnimating = false;
          resolve(); // ส่งสัญญาณบอกว่าแอนิเมชันรอบนี้จบแล้ว!
        }
      });
    });
  }
  
  // ฟังก์ชันสุ่มหมุน 20 ครั้ง
  public async shuffleCube(moves: number = 20): Promise<void> {
    if (this.isAnimating) return; // ถ้ากำลังหมุนอยู่อย่าเพิ่งกวน

    const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
    const coordinates = [-1.05, 0, 1.05]; // พิกัดแกนของแต่ละแถว (อ้างอิงจากตัวแปร spacing)
    const angles = [Math.PI / 2, -Math.PI / 2]; // หมุนไปหน้า/หลัง

    for (let i = 0; i < moves; i++) {
      const randomAxis = axes[Math.floor(Math.random() * axes.length)];
      const randomCoord = coordinates[Math.floor(Math.random() * coordinates.length)];
      const randomAngle = angles[Math.floor(Math.random() * angles.length)];
      
      // สั่งหมุนด้วยความเร็ว 0.15 วินาทีต่อครั้ง และรอจนกว่าจะหมุนเสร็จ (await) ค่อยไปรอบต่อไป
      await this.rotateLayer(randomAxis, randomCoord, randomAngle, 0.15); 
    }
  }

  // ฟังก์ชันล้างค่ากลับเป็นหน้าสีเดิม
  public resetCube(): void {
    if (this.isAnimating) return;
    
    // ลบชิ้นส่วนเก่าออกทั้งหมด
    while(this.cubeGroup.children.length > 0) { 
        this.cubeGroup.remove(this.cubeGroup.children[0]); 
    }
    // สร้างรูบิกใหม่
    this.buildRubik();
  }
}
