import { Injectable, ElementRef, NgZone } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import gsap from 'gsap';

@Injectable({
  providedIn: 'root',
})
export class Engine {
  private canvas!: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  
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

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; // เปิดใช้ความหน่วง ทำให้เวลาหมุนสมูทขึ้น
    this.controls.dampingFactor = 0.05; // ระดับความหน่วง
    this.controls.enablePan = false;    // ปิดการคลิกขวาแล้วเลื่อนกล้อง (บังคับให้อยู่ตรงกลางเสมอ)
    this.controls.minDistance = 4;      // ซูมเข้าได้ใกล้สุดแค่นี้
    this.controls.maxDistance = 15;     // ซูมออกได้ไกลสุดแค่นี้

    window.addEventListener('resize', () => this.onWindowResize());

    this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    this.canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));

    // 5. เริ่มลูปเรนเดอร์
    this.animate();
  }

  private buildRubik(): void {
    // กำหนดสีของทั้ง 6 ด้าน: ขวา(แดง), ซ้าย(ส้ม), บน(ขาว), ล่าง(เหลือง), หน้า(เขียว), หลัง(น้ำเงิน)
    const colors = [0xff0000, 0xffa500, 0xffffff, 0xffff00, 0x00ff00, 0x0000ff];
    const materials = colors.map(color => new THREE.MeshBasicMaterial({ color }));

    const size = 1;      // ขนาดชิ้นส่วน 1x1x1
    const spacing = 1.05; // ระยะห่างเพื่อให้เห็นขอบดำระหว่างชิ้น

    // สร้างลูปแกน x, y, z (3x3x3 = 27 ชิ้น)
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const geometry = new THREE.BoxGeometry(size, size, size);
          const cubie = new THREE.Mesh(geometry, materials);

          // เพิ่มเส้นขอบสีดำให้ดูเป็นชิ้นๆ
          const edges = new THREE.EdgesGeometry(geometry);
          const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
          cubie.add(line);

          // กำหนดตำแหน่ง 3 มิติ
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
    
    // อัปเดตสัดส่วนของกล้อง
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    // อัปเดตขนาดของ Renderer
    this.renderer.setSize(width, height);
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
