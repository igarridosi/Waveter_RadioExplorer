import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const Visualizer = ({ audioRef }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;

    if (!audio) return;

    let audioContext;
    let analyser;
    let dataArray;
    let scene, camera, renderer, bars;

    const initializeAudio = () => {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        const source = audioContext.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
      }
      initializeVisualizer();
      animate();
    };

    const initializeVisualizer = () => {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      renderer = new THREE.WebGLRenderer({ canvas });
      renderer.setSize(canvas.width, canvas.height);

      bars = [];
      for (let i = 0; i < 64; i++) {
        const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const bar = new THREE.Mesh(geometry, material);
        bar.position.x = i - 32;
        scene.add(bar);
        bars.push(bar);
      }

      camera.position.z = 50;
    };

    const animate = () => {
      requestAnimationFrame(animate);

      analyser.getByteFrequencyData(dataArray);

      for (let i = 0; i < bars.length; i++) {
        bars[i].scale.y = dataArray[i] / 50;
      }

      renderer.render(scene, camera);
    };

    audio.addEventListener('play', initializeAudio);

    return () => {
      audio.removeEventListener('play', initializeAudio);
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [audioRef]);

  return <canvas ref={canvasRef} width="800" height="600" className="w-full h-72 bg-gray-800 rounded-lg mt-8"></canvas>;
};

export default Visualizer;