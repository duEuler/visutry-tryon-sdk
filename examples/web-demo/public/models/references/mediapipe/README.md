# MediaPipe canonical face model

`canonical_face_model.obj` is distributed by the MediaPipe project and is used
as the static 468-vertex topology for the Studio's diagnostic Viewports.

- Source: https://github.com/google-ai-edge/mediapipe/tree/master/mediapipe/modules/face_geometry/data
- License: Apache License 2.0
- Runtime use: the mesh positions are replaced by the current MediaPipe face
  landmarks while the canonical triangle topology is preserved.
