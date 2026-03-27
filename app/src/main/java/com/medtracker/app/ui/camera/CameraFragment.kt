package com.medtracker.app.ui.camera

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.bumptech.glide.Glide
import com.medtracker.app.databinding.FragmentCameraBinding
import com.medtracker.app.data.entity.MedicationRecord
import com.medtracker.app.viewmodel.MainViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraFragment : Fragment() {

    private var _binding: FragmentCameraBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MainViewModel by activityViewModels()

    private var imageCapture: ImageCapture? = null
    private lateinit var cameraExecutor: ExecutorService
    private var capturedPhotoPath: String? = null
    private var isPreviewMode = false  // false=拍照模式, true=预览确认模式

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCameraBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        cameraExecutor = Executors.newSingleThreadExecutor()

        startCamera()

        binding.btnCapture.setOnClickListener {
            takePhoto()
        }

        binding.btnConfirm.setOnClickListener {
            saveRecord()
        }

        binding.btnRetake.setOnClickListener {
            retakePhoto()
        }

        binding.btnCancel.setOnClickListener {
            findNavController().navigateUp()
        }

        // 显示药物列表提示
        viewModel.medications.observe(viewLifecycleOwner) { medications ->
            val hint = medications.joinToString("\n") { med ->
                "• ${med.name}（${med.color} · ${med.shape}）"
            }
            binding.tvMedHint.text = if (hint.isNotEmpty()) {
                "请确保以下药物均在照片中：\n$hint"
            } else {
                "请将所有药物放在一起拍照"
            }
        }

        showCameraMode()
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(requireContext())
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder()
                .build()
                .also { it.setSurfaceProvider(binding.viewFinder.surfaceProvider) }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .build()

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCapture)
            } catch (e: Exception) {
                Log.e("CameraFragment", "摄像头绑定失败", e)
                Toast.makeText(requireContext(), "摄像头启动失败", Toast.LENGTH_SHORT).show()
            }
        }, ContextCompat.getMainExecutor(requireContext()))
    }

    private fun takePhoto() {
        val imageCapture = imageCapture ?: return

        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val timestamp = SimpleDateFormat("HHmmss", Locale.getDefault()).format(Date())
        val fileName = "MedTracker_${today}_${timestamp}.jpg"

        // 保存到外部存储
        val contentValues = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
            put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/MedTracker")
        }

        val outputOptions = ImageCapture.OutputFileOptions.Builder(
            requireContext().contentResolver,
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            contentValues
        ).build()

        binding.btnCapture.isEnabled = false
        binding.progressBar.visibility = View.VISIBLE

        imageCapture.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(requireContext()),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    capturedPhotoPath = output.savedUri?.toString() ?: ""
                    binding.progressBar.visibility = View.GONE
                    showPreviewMode(output.savedUri)
                }

                override fun onError(exception: ImageCaptureException) {
                    binding.progressBar.visibility = View.GONE
                    binding.btnCapture.isEnabled = true
                    Log.e("CameraFragment", "拍照失败", exception)
                    Toast.makeText(requireContext(), "拍照失败，请重试", Toast.LENGTH_SHORT).show()
                }
            }
        )
    }

    private fun showPreviewMode(uri: Uri?) {
        isPreviewMode = true
        binding.viewFinder.visibility = View.GONE
        binding.imgPreview.visibility = View.VISIBLE
        binding.layoutCameraActions.visibility = View.GONE
        binding.layoutConfirmActions.visibility = View.VISIBLE
        binding.tvInstructions.text = "请确认照片中包含所有药物"

        uri?.let {
            Glide.with(this).load(it).into(binding.imgPreview)
        }
    }

    private fun showCameraMode() {
        isPreviewMode = false
        binding.viewFinder.visibility = View.VISIBLE
        binding.imgPreview.visibility = View.GONE
        binding.layoutCameraActions.visibility = View.VISIBLE
        binding.layoutConfirmActions.visibility = View.GONE
        binding.tvInstructions.text = "将所有药物放在同一画面内拍照"
    }

    private fun retakePhoto() {
        capturedPhotoPath = null
        showCameraMode()
        binding.btnCapture.isEnabled = true
    }

    private fun saveRecord() {
        val photoPath = capturedPhotoPath ?: ""
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val timeNow = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())

        CoroutineScope(Dispatchers.IO).launch {
            val existing = viewModel.getRecordByDate(today)
            val record = if (existing != null) {
                existing.copy(
                    photoPath = photoPath,
                    isTaken = true,
                    takenTime = timeNow
                )
            } else {
                MedicationRecord(
                    date = today,
                    takenTime = timeNow,
                    photoPath = photoPath,
                    isTaken = true
                )
            }
            viewModel.saveRecord(record)

            withContext(Dispatchers.Main) {
                Toast.makeText(requireContext(), "✅ 今日服药记录已保存！", Toast.LENGTH_LONG).show()
                findNavController().navigateUp()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        cameraExecutor.shutdown()
        _binding = null
    }
}
