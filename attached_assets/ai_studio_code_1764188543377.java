package com.example;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.genai.Client;
import com.google.genai.ResponseStream;
import com.google.genai.types.*;
import com.google.gson.Gson;

import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.apache.tika.mime.MimeTypeException;
import org.apache.tika.mime.MimeTypes;

public class App {
  static void saveBinaryFile(String fileName, byte[] content) {
    try {
      FileOutputStream out = new FileOutputStream(fileName);
      out.write(content);
      out.close();
      System.out.println("Saved file: " + fileName);
    } catch (IOException e) {
        System.out.println(e.getMessage());
    }
  }

  public static void main(String[] args) {
    String apiKey = System.getenv("GEMINI_API_KEY");
    Client client = Client.builder().apiKey(apiKey).build();
    Gson gson = new Gson();
    MimeTypes allTypes = MimeTypes.getDefaultMimeTypes();

    List<Tool> tools = new ArrayList<>();
    tools.add(
      Tools.builder()
        .googleSearch(
          GoogleSearch.builder()
              .build())
            .build()
    );

    String model = "gemini-3-pro-image-preview";
    List<Content> contents = ImmutableList.of(
      Content.builder()
        .role("user")
        .parts(ImmutableList.of(
          Part.fromText("Generate an image of a banana wearing a costume.")
        ))
        .build()
    );
    GenerateContentConfig config =
      GenerateContentConfig
      .builder()
      .responseModalities(ImmutableList.of(
          "IMAGE",
          "TEXT"
      ))
      .imageConfig(
        ImageConfig
          .builder()
          .imageSize("1K")
          .build()
      )
      .tools(tools)
      .build();

    ResponseStream<GenerateContentResponse> responseStream = client.models.generateContentStream(model, contents, config);

    for (GenerateContentResponse res : responseStream) {
      if (res.candidates().isEmpty() || res.candidates().get().get(0).content().isEmpty() || res.candidates().get().get(0).content().get().parts().isEmpty()) {
        continue;
      }

      List<Part> parts = res.candidates().get().get(0).content().get().parts().get();
      for (Part part : parts) {
        if (part.inlineData().isPresent()) {
          String fileName = "ENTER_FILE_NAME";
          Blob inlineData = part.inlineData().get();
          String fileExtension;
          try {
            fileExtension = allTypes.forName(inlineData.mimeType().orElse("")).getExtension();
          } catch (MimeTypeException e) {
            fileExtension = "";
          }
          saveBinaryFile(fileName + "." + fileExtension, inlineData.data().get());
        }
        else {
          System.out.println(part.text());
        }
      }
    }

    responseStream.close();
  }
}
