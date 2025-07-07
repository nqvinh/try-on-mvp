# Try On Fashion MVP - Technical Documentation

A comprehensive virtual fashion try-on platform built with Next.js, Three.js, and multiple AI services for body generation, pose manipulation, face swapping, and virtual clothing try-on.

## 🎥 Demo Video

https://cdn.nqvinh.dev/Try%20On%20Demo.mp4

*Watch the demo to see the virtual try-on platform in action!*

## 🏗️ Architecture Overview

### Frontend Architecture
- **Framework**: Next.js 14 with TypeScript
- **State Management**: React Hooks with localStorage persistence
- **Styling**: Tailwind CSS with custom components
- **3D Rendering**: Three.js with custom WebGL shaders
- **Image Processing**: Canvas API for client-side image manipulation

### Backend Architecture
- **API Routes**: Next.js API routes for server-side processing
- **Image Storage**: AWS S3/DigitalOcean Spaces integration
- **AI Services**: Multiple AI providers with fallback mechanisms
- **File Processing**: Formidable for multipart form handling

### AI Pipeline Architecture
```
User Input → 3D Body Model → Flux ControlNet → Gemini Pose → Face Swap → Try-On
```

### Iframe-Based 3D Visualization Architecture
```
React Component → Iframe (public/3dbody/index.html) → WebGL Renderer → postMessage → Parent Component
```

**Technical Benefits:**
- **Isolation**: WebGL context isolated in iframe prevents conflicts with React rendering
- **Performance**: Direct WebGL access without React re-render overhead
- **Legacy Integration**: Seamless integration of existing WebGL body generator
- **Cross-Origin Communication**: Secure postMessage API for parent-child communication
- **State Management**: Independent iframe state management with controlled synchronization

## 🔧 Technical Implementation

### 2. AI Generation Pipeline

#### Flux ControlNet Integration (`pages/api/fal-ai.ts`)
```typescript
// Body generation with control images
const result = await fal.subscribe("fal-ai/flux-control-lora-canny", {
  input: {
    prompt: "A beautiful Asian female fashion model...",
    image_size: "square_hd",
    num_inference_steps: 30,
    guidance_scale: 7,
    control_lora_strength: 0.95,
    control_lora_image_url: imageUrl, // 3D body model output
    loras: [
      {
        path: "https://civitai.com/api/download/models/800194",
        scale: 0.9
      }
    ]
  }
})
```

#### Gemini Pose Manipulation (`pages/api/google-ai.ts`)
```typescript
// Pose changing with image generation
const result = await ai.models.generateContent({
  model: "gemini-2.0-flash-preview-image-generation",
  contents: [
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64ImageData,
      },
    },
    { text: "change pose of this image to a fashion model pose..." }
  ],
  config: {
    responseModalities: [Modality.TEXT, Modality.IMAGE],
  },
})
```

#### Face Swap Processing (`pages/api/fal-ai.ts`)
```typescript
// Advanced face swapping
const result = await fal.subscribe("easel-ai/advanced-face-swap", {
  input: {
    face_image_0: userFaceImage,
    gender_0: userGender,
    target_image: generatedBodyImage,
    workflow_type: "user_hair" // Preserve user's hair
  }
})
```

### 3. Virtual Try-On System

#### Try-On API (`pages/api/try-on.ts`)
```typescript
// Kling v1.5 Kolors integration
const result = await fal.subscribe("fal-ai/kling/v1-5/kolors-virtual-try-on", {
  input: {
    human_image_url: userImageUrl,
    garment_image_url: productImageUrl
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log)
    }
  },
})
```

#### Image Processing Pipeline
```typescript
// Client-side image preprocessing
const cropImageToRatio = async (imageUrl: string): Promise<string> => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  // Calculate 3:4 aspect ratio
  const targetRatio = 3/4
  // Crop and resize logic...
  
  return canvas.toDataURL('image/jpeg', 0.9)
}
```

### 4. 3D Body Visualization

#### Iframe-Based Body Visualizer (`public/3dbody/index.html`)
The system uses an embedded iframe containing a standalone WebGL 3D body generator for real-time body shape visualization and manipulation.

```html
<!-- Iframe integration in create-avatar.tsx -->
<iframe
  ref={iframeRef}
  src="/3dbody/index.html"
  className="w-full h-full border-2 border-zinc-200 dark:border-zinc-700 rounded-lg"
  title="Body Visualizer"
  style={{
    maxWidth: '100%',
    height: 'auto',
    minHeight: '300px',
    width: '100%'
  }}
  onWheel={(e) => {
    e.preventDefault();
    e.stopPropagation();
  }}
/>
```

#### WebGL 3D Body Generator (`public/3dbody/main.js`)
```javascript
// Core 3D scene setup
var CAMERA, CONTROLS, SCENE, RENDERER;
var MESH;
var VERTEX_RESULT;

// Body parameters with statistical modeling
var numParams = 8;
var arrayParamNames = ['Bust', 'Under Bust', 'Waist', 'Hip', 'Neck Girth', 'Inside Leg', 'Shoulder', 'Body Height'];
var arrayParamsMinMax = [[ 79.0,  70.0,  52.0,  79.0,  29.0,  65.0,  29.0, 145.0],
                         [113.0, 101.0, 113.0, 121.0,  45.0,  95.0,  60.0, 201.0]];

// Real-time body generation with statistical models
function generateBody() {
    if (GENDER == GenderEnum.Female) {
        var r = DBf['R'];  // Statistical correlation matrix
        var e = DBf['e'];  // Mean values
        var pc = DBf['pc']; // Principal components
        var mA = DBf['mA']; // Mean mesh
    }
    
    // Apply statistical shape variations
    var para = new Array(numParams-1);
    for (var i = 0; i < numParams-1; ++i)
        para[i] = arrayParams[i]/arrayParams[7];
    
    var Rl = numeric.dot(r, para);
    numeric.addeq(Rl, e);
    VERTEX_RESULT = numeric.dot(pc, Rl);
    numeric.addeq(VERTEX_RESULT, mA);
    VERTEX_RESULT = numeric.mul(VERTEX_RESULT, arrayParams[7]/100.0);
    
    // Update mesh vertices
    for (var i = 0; i < MESH.geometry.vertices.length; ++i) {
        MESH.geometry.vertices[i].x = VERTEX_RESULT[3*i];
        MESH.geometry.vertices[i].y = VERTEX_RESULT[3*i+1] - MIN_Y;
        MESH.geometry.vertices[i].z = VERTEX_RESULT[3*i+2];
    }
    
    MESH.geometry.verticesNeedUpdate = true;
    MESH.geometry.computeVertexNormals();
}
```

#### Cross-Frame Communication (`pages/create-avatar.tsx`)
```typescript
// Parent-to-iframe communication for body capture
const handleCreateBody = async () => {
  const iframeWindow = iframeRef.current?.contentWindow
  if (!iframeWindow) {
    throw new Error('Iframe not found')
  }

  // Send save command to iframe
  iframeWindow.postMessage({ type: 'SAVE_BODY' }, '*')
  
  // Wait for response with image data
  const imageData = await new Promise<string>((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'BODY_SAVED') {
        window.removeEventListener('message', handleMessage)
        resolve(event.data.imageData)
      }
    }
    window.addEventListener('message', handleMessage)
    setTimeout(() => {
      window.removeEventListener('message', handleMessage)
      reject(new Error('Timeout waiting for body save'))
    }, 10000)
  })
}
```

#### Iframe Response Handler (`public/3dbody/main.js`)
```javascript
// Listen for save commands from parent window
window.addEventListener('message', function(event) {
    if (event.data.type === 'SAVE_BODY') {
        // Store current camera and renderer states
        var wasVisible = MEASURE_CURVES.visible;
        var originalFOV = CAMERA.fov;
        var originalPosition = CAMERA.position.clone();
        
        // Configure for high-quality capture
        MEASURE_CURVES.visible = false;
        CAMERA.fov = 45;
        CAMERA.position.set(0, 1, 2.5);
        CONTROLS.target.set(0, 0.8, 0);
        RENDERER.setSize(1024, 1024);
        CAMERA.aspect = 1;
        CAMERA.updateProjectionMatrix();
        
        // Render and capture
        for (let i = 0; i < 3; i++) {
            RENDERER.render(SCENE, CAMERA);
        }
        
        var canvas = RENDERER.domElement;
        var image = canvas.toDataURL('image/png');
        
        // Restore original states
        MEASURE_CURVES.visible = wasVisible;
        CAMERA.fov = originalFOV;
        CAMERA.position.copy(originalPosition);
        // ... restore other states
        
        // Send image data back to parent
        window.parent.postMessage({
            type: 'BODY_SAVED',
            imageData: image
        }, '*');
    }
});
```

#### Three.js Scene Management (`pages/body-visualizer.tsx`)
```typescript
// Real-time 3D rendering with measurement updates
const handleMeasurementChange = useCallback(
  debounce((name: string, value: number, index: number) => {
    // Gaussian model conditioning
    gaussianModel.conditionOnIndices([index], [value])
    
    // Animated model updates
    const numberOfIncrements = 8
    const updateModel = () => {
      const interpolatedFactors = oldScaleFactors.map((old, i) => {
        const end = newScaleFactors[i]
        return old + (currentIncrement / numberOfIncrements) * (end - old)
      })
      
      // Update Three.js mesh
      modelLoader.setScalefactor(i, factor)
    }
  }, 100)
)
```

#### Custom Body Models (`body-shape-script/model.ts`)
```typescript
export class Model {
  private mesh: THREE.Mesh
  private offsetMeshes: THREE.Mesh[]
  private originalPositions: number[]
  
  // Real-time vertex manipulation
  setScalefactor(index: number, value: number): void {
    // Apply statistical shape variations
    const vertices = this.calculateVertices(index, value)
    this.updateMeshGeometry(vertices)
  }
}
```

## 📊 Data Flow Architecture

### Avatar Creation Flow
```
1. User Upload → Image Preprocessing → Cloud Storage
2. 3D Body Model → Statistical Analysis → Gaussian Conditioning
3. Flux ControlNet → Body Generation → Gemini Pose → Face Swap
4. Result Storage → Avatar Management → Try-On Integration
```

### Try-On Processing Flow
```
1. Avatar Selection → Image Validation → API Preparation
2. Clothing Upload → Image Processing → Cloud Storage
3. Fal AI Try-On → Real-time Progress → Result Generation
4. History Management → Gallery Display → User Feedback
```

## 🔌 API Integration Details

### Fal AI Services
```typescript
// Service configuration
const falConfig = {
  key: process.env.FAL_KEY,
  proxyUrl: process.env.FAL_PROXY_URL
}

// Endpoint mapping
const endpoints = {
  bodyGeneration: "fal-ai/flux-control-lora-canny",
  faceSwap: "easel-ai/advanced-face-swap",
  tryOn: "fal-ai/kling/v1-5/kolors-virtual-try-on"
}
```

### Google Gemini Integration
```typescript
// Model configuration
const ai = new GoogleGenAI({ 
  apiKey: process.env.GOOGLE_API_KEY 
})

// Image processing pipeline
const processImage = async (imageUrl: string, prompt: string) => {
  const response = await fetch(imageUrl)
  const imageArrayBuffer = await response.arrayBuffer()
  const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64')
  
  return ai.models.generateContent({
    model: "gemini-2.0-flash-preview-image-generation",
    contents: [
      { inlineData: { mimeType: 'image/jpeg', data: base64ImageData } },
      { text: prompt }
    ]
  })
}
```

## 🗄️ Data Management

### Local Storage Schema
```typescript
// Avatar storage
interface StoredAvatar {
  id: number
  name: string
  src: string
  uploadDate: string
}

// Try-on history
interface TryOnHistory {
  id: string
  avatarId: number
  clothingId: number
  resultUrl: string
  timestamp: string
  metadata: {
    processingTime: number
    aiServices: string[]
  }
}
```

### Cloud Storage Integration
```typescript
// AWS S3/DigitalOcean Spaces upload
const uploadToCloud = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('image', file)
  
  const response = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData
  })
  
  const data = await response.json()
  return data.url
}
```

## 🎛️ Configuration Management

### Environment Variables
```env
# AI Services
FAL_KEY=your_fal_ai_key
GOOGLE_API_KEY=your_google_api_key
REPLICATE_API_TOKEN=your_replicate_token

# Cloud Storage
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_BUCKET_NAME=your_bucket_name

# Application
NEXT_PUBLIC_API_URL=http://localhost:3000
NODE_ENV=development
```

### AI Model Parameters
```typescript
// Flux ControlNet settings
const fluxConfig = {
  image_size: "square_hd",
  num_inference_steps: 30,
  guidance_scale: 7,
  control_lora_strength: 0.95,
  enable_safety_checker: true
}

// Gemini settings
const geminiConfig = {
  model: "gemini-2.0-flash-preview-image-generation",
  responseModalities: [Modality.TEXT, Modality.IMAGE]
}
```

## 🔍 Performance Optimization

### Image Processing
- Client-side image cropping and resizing
- Progressive image loading with lazy loading
- WebP format support for better compression
- Canvas-based image manipulation

### 3D Rendering
- Debounced measurement updates (100ms)
- Interpolated model animations
- Efficient Three.js geometry updates
- Memory management for large meshes

### API Optimization
- Request caching and deduplication
- Parallel processing for multiple AI services
- Error handling with retry mechanisms
- Progress tracking for long-running operations

## 🧪 Testing Strategy



## 🔒 Security Considerations

### API Key Protection
- Environment variable usage
- Server-side API calls only
- No client-side exposure of sensitive keys

### Image Security
- File type validation
- Size limits enforcement
- Secure cloud storage access
- Temporary URL generation

### Data Privacy
- Local processing for measurements
- Optional data retention
- User consent for AI processing
- GDPR compliance considerations

---

**Technical Stack**: Next.js 14, TypeScript, Three.js, Tailwind CSS, Fal AI, Google Gemini, AWS S3, Statistical Modeling
