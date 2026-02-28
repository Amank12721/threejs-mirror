uniform vec3 uCameraPosition;
uniform samplerCube envMap;
uniform float curvature; // 0 = flat, positive = convex, negative = concave
uniform float mirrorRadius; // radius of curvature
uniform vec3 mirrorCenter; // center of the curved mirror

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
    vec3 viewDirection = normalize(vWorldPosition - uCameraPosition);
    vec3 normal = normalize(vWorldNormal);
    
    // Apply curvature to the normal
    if (abs(curvature) > 0.001) {
        // Calculate distance from center
        vec3 toPoint = vWorldPosition - mirrorCenter;
        float dist = length(toPoint);
        
        // Modify normal based on curvature
        // For convex: normal points outward more
        // For concave: normal points inward more
        vec3 radialDir = normalize(toPoint);
        
        // Blend between flat normal and radial direction based on curvature
        float curvatureEffect = curvature * dist / mirrorRadius;
        normal = normalize(mix(normal, radialDir * sign(curvature), abs(curvatureEffect)));
    }
    
    // Calculate reflection direction
    vec3 reflected = reflect(viewDirection, normal);
    
    // Sample environment map
    vec4 envColor = textureCube(envMap, reflected);
    
    // Add slight tint for mirror effect
    vec3 mirrorTint = vec3(0.53, 0.6, 0.6); // Slight blue-gray tint
    gl_FragColor = vec4(envColor.rgb * mirrorTint, 1.0);
}
