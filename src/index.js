import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import axios from 'axios'
import { submitForReview } from './submission.js'

const start = async () => {
  const fastify = Fastify({
    logger: true,
  })

  // Variables globales pour les recettes
  const cityRecipes = {};
  let globalRecipeId = 1;
  const BASE_URL = 'https://api-ugi2pflmha-ew.a.run.app';

  // Enregistrement du middleware CORS
  try {
    await fastify.register(cors)

    // Route racine
    fastify.get('/', async (request, reply) => {
      reply.send({ message: 'Bienvenue sur l\'API des villes et recettes' });
    });

    // Route GET /cities/:cityId/infos
    fastify.get('/cities/:cityId/infos', async (request, reply) => {
      const { cityId } = request.params;
      const apiKey = process.env.API_KEY;

      try {
        const cityResponse = await axios.get(`${BASE_URL}/cities/${cityId}/infos`, {
          params: { apiKey }
        });

        const weatherResponse = await axios.get(`${BASE_URL}/weather-predictions`, {
          params: { cityId, apiKey }
        });

        const result = {
          coordinates: [
            cityResponse.data.coordinates.latitude, 
            cityResponse.data.coordinates.longitude
          ],
          population: cityResponse.data.population,
          knownFor: cityResponse.data.knownFor,
          weatherPredictions: [
            {
              when: 'today',
              min: weatherResponse.data.today.min,
              max: weatherResponse.data.today.max
            },
            {
              when: 'tomorrow',
              min: weatherResponse.data.tomorrow.min,
              max: weatherResponse.data.tomorrow.max
            }
          ],
          recipes: cityRecipes[cityId] || []
        };

        reply.send(result);
      } catch (error) {
        reply.status(404).send({ error: 'Ville non trouvée' });
      }
    });

    // Route POST /cities/:cityId/recipes
    fastify.post('/cities/:cityId/recipes', async (request, reply) => {
      const { cityId } = request.params;
      const { content } = request.body;

      if (!content) {
        return reply.status(400).send({ error: 'Le contenu est requis' });
      }
      if (content.length < 10) {
        return reply.status(400).send({ error: 'Le contenu doit faire au moins 10 caractères' });
      }
      if (content.length > 2000) {
        return reply.status(400).send({ error: 'Le contenu ne doit pas dépasser 2000 caractères' });
      }

      try {
        await axios.get(`${BASE_URL}/cities/${cityId}/infos`, {
          params: { apiKey: process.env.API_KEY }
        });

        if (!cityRecipes[cityId]) {
          cityRecipes[cityId] = [];
        }

        const newRecipe = {
          id: globalRecipeId++,
          content
        };

        cityRecipes[cityId].push(newRecipe);
        reply.status(201).send(newRecipe);
      } catch (error) {
        reply.status(404).send({ error: 'Ville non trouvée' });
      }
    });

    // Route DELETE /cities/:cityId/recipes/:recipeId
    fastify.delete('/cities/:cityId/recipes/:recipeId', async (request, reply) => {
      const { cityId, recipeId } = request.params;

      try {
        await axios.get(`${BASE_URL}/cities/${cityId}/infos`, {
          params: { apiKey: process.env.API_KEY }
        });

        const recipes = cityRecipes[cityId];
        if (!recipes) {
          return reply.status(404).send({ error: 'Recette non trouvée' });
        }

        const recipeIdNum = parseInt(recipeId, 10);
        const index = recipes.findIndex(recipe => recipe.id === recipeIdNum);
        
        if (index === -1) {
          return reply.status(404).send({ error: 'Recette non trouvée' });
        }

        recipes.splice(index, 1);
        reply.status(204).send();
      } catch (error) {
        reply.status(404).send({ error: 'Ville non trouvée' });
      }
    });

    // Démarrage du serveur
    await fastify.listen({
      port: process.env.PORT || 3000,
      host: process.env.RENDER_EXTERNAL_URL ? '0.0.0.0' : process.env.HOST || 'localhost',
    });

    submitForReview(fastify);

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();