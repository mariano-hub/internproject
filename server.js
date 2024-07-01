// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const express = require('express');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');

(async () => {
  // Dynamically import the into-stream module
  const getStream = (await import('into-stream')).default;

  // Create a blob service client using the connection string from environment variables
  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Initialize Express app
  const app = express();

  // Configure multer for handling file uploads in memory
  const upload = multer({ storage: multer.memoryStorage() });

  // Upload Image Endpoint
  app.post('/upload-image', upload.single('file'), async (req, res) => {
    const blobName = req.file.originalname; // Use the original file name as the blob name
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      await blockBlobClient.uploadData(req.file.buffer, {
        blobHTTPHeaders: { blobContentType: req.file.mimetype }
      });
      res.status(200).send({ message: 'Image uploaded successfully' });
    } catch (err) {
      res.status(500).send({ message: 'Error uploading image', error: err.message });
    }
  });

  // Endpoint to list all images
  app.get('/api/images', async (req, res) => {
    const images = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
      images.push({
        name: blob.name,
        url: blockBlobClient.url,
        properties: blob.properties
      });
    }
    res.status(200).send(images);
  });

  // Endpoint to get image details
  app.get('/images/:id', async (req, res) => {
    const blobName = req.params.id; // Get the image ID from the request parameters
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      const properties = await blockBlobClient.getProperties();
      res.status(200).send(properties);
    } catch (err) {
      res.status(500).send({ message: 'Error fetching image details', error: err.message });
    }
  });

  // Endpoint to update image metadata
  app.put('/images/:id', express.json(), async (req, res) => {
    const blobName = req.params.id; // Get the image ID from the request parameters
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const metadata = req.body;

    try {
      await blockBlobClient.setMetadata(metadata);
      res.status(200).send({ message: 'Image metadata updated successfully' });
    } catch (err) {
      res.status(500).send({ message: 'Error updating image metadata', error: err.message });
    }
  });

  // Start the server on port 3000
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
})();
