import fastify from 'fastify'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { r2 } from './lib/cloudflare'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import cors from '@fastify/cors'

const server = fastify()
server.register(cors, {
  methods: [
    "GET",
    "PUT",
    "DELETE",
    "POST"
  ],
  origin: "*"
})

const prismaClient = new PrismaClient()


server.post('/upload', async (req, reply) => {
  const uploadBodySchema = z.object({
    name: z.string().min(1),
    contentType: z.string().regex(/\w\/[-+.\w]+/)
  })

  const { contentType, name } = uploadBodySchema.parse(req.body)
  const fileKey = randomUUID().concat(`-${name}`)
  
  //Comando para assinar um URL
  const signedUrl = await getSignedUrl(
    r2,

    //Comando para uplpad de arquivo
    new PutObjectCommand({
      Bucket: 'uploadimage-dev',
      Key: fileKey,
      ContentType: contentType
    }),

    { expiresIn: 600 }
  )

  const file = await prismaClient.file.create({
    data: {
      name,
      contentType,
      key: fileKey
    }
  })
  return { signedUrl, file: file.id }
})

server.get('/uploads/:id', async (request) => {
  const getFileParamsSchema = z.object({
    id: z.string().cuid()
  })

  const { id } = getFileParamsSchema.parse(request.params)

  const file = await prismaClient.file.findUniqueOrThrow({
    where: {
      id
    }
  })

  const signedUrl = await getSignedUrl(
    r2,

    //Comando para uplpad de arquivo
    new GetObjectCommand({
      Bucket: 'uploadimage-dev',
      Key: file.key,
    }),

    { expiresIn: 600 }
  )


  
  return { signedUrl }

})

server.get('/users', async (req, reply) => {

  const users = await prismaClient.project.findMany({
    include: {
      files: true
    }
  })

  return reply.send(users).status(201)
})

server.listen({
  port: 3333,
  host: '0.0.0.0'
}).then(() => {
  console.log("HTTP Server Running in port 3333")
})