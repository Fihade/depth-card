import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Upload() {
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [depthImage, setDepthImage] = useState<File | null>(null);
  const router = useRouter();

  const handleOriginalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setOriginalImage(e.target.files[0]);
    }
  };

  const handleDepthImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDepthImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (originalImage && depthImage) {
      // Here you would typically upload the images to your server
      // For this example, we'll just pass the file names to the main page
      router.push({
        pathname: '/',
        query: { 
          originalImage: originalImage.name,
          depthImage: depthImage.name
        },
      });
    } else {
      alert('Please upload both images');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Upload Images</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="originalImage" className="block mb-2">Original Image:</label>
          <input
            type="file"
            id="originalImage"
            accept="image/*"
            onChange={handleOriginalImageUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-violet-50 file:text-violet-700
              hover:file:bg-violet-100"
          />
        </div>
        <div>
          <label htmlFor="depthImage" className="block mb-2">Depth Image:</label>
          <input
            type="file"
            id="depthImage"
            accept="image/*"
            onChange={handleDepthImageUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-violet-50 file:text-violet-700
              hover:file:bg-violet-100"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Upload and View
        </button>
      </form>
    </div>
  );
}