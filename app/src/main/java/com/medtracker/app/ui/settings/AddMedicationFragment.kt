package com.medtracker.app.ui.settings

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.bumptech.glide.Glide
import com.google.android.material.chip.Chip
import com.medtracker.app.R
import com.medtracker.app.databinding.FragmentAddMedicationBinding
import com.medtracker.app.data.entity.Medication
import com.medtracker.app.viewmodel.MainViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AddMedicationFragment : Fragment() {

    private var _binding: FragmentAddMedicationBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MainViewModel by activityViewModels()

    private var selectedColorCode: Int = Color.WHITE
    private var selectedPhotoPath: String = ""
    private var editingMedicationId: Long = -1L

    // 预设颜色
    private val colorOptions = listOf(
        "白色" to Color.WHITE,
        "黄色" to Color.parseColor("#FFF176"),
        "粉红色" to Color.parseColor("#F48FB1"),
        "橙色" to Color.parseColor("#FFAB40"),
        "蓝色" to Color.parseColor("#4FC3F7"),
        "绿色" to Color.parseColor("#81C784"),
        "红色" to Color.parseColor("#E57373"),
        "紫色" to Color.parseColor("#CE93D8"),
        "棕色" to Color.parseColor("#A1887F"),
        "灰色" to Color.parseColor("#B0BEC5")
    )

    // 预设形状
    private val shapeOptions = listOf(
        "圆形", "椭圆形", "胶囊形", "长方形", "三角形", "菱形", "异形"
    )

    private val pickImageLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                selectedPhotoPath = uri.toString()
                Glide.with(this).load(uri).into(binding.imgMedPhoto)
                binding.tvPhotoHint.visibility = View.GONE
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAddMedicationBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        editingMedicationId = arguments?.getLong("medication_id", -1L) ?: -1L

        setupColorPicker()
        setupShapePicker()

        // 剂量输入提示
        val dosageOptions = arrayOf("1片", "2片", "3片", "半片", "1粒", "2粒", "1颗", "2颗")
        val dosageAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, dosageOptions)
        binding.etDosage.setAdapter(dosageAdapter)

        // 选择照片
        binding.cardMedPhoto.setOnClickListener {
            val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
            pickImageLauncher.launch(intent)
        }

        // 如果是编辑模式，加载已有数据
        if (editingMedicationId != -1L) {
            binding.tvTitle.text = "编辑药物"
            binding.btnSave.text = "保存修改"
            loadExistingMedication()
        }

        binding.btnSave.setOnClickListener {
            saveMedication()
        }

        binding.btnCancel.setOnClickListener {
            findNavController().navigateUp()
        }
    }

    private fun setupColorPicker() {
        colorOptions.forEachIndexed { index, (colorName, colorCode) ->
            val chip = Chip(requireContext()).apply {
                text = colorName
                isCheckable = true
                chipBackgroundColor = android.content.res.ColorStateList.valueOf(colorCode)
                setTextColor(if (colorCode == Color.WHITE) Color.BLACK else Color.BLACK)
                strokeWidth = 2f
                strokeColor = android.content.res.ColorStateList.valueOf(Color.parseColor("#BDBDBD"))
            }
            chip.setOnCheckedChangeListener { _, isChecked ->
                if (isChecked) {
                    selectedColorCode = colorCode
                    binding.viewSelectedColor.setBackgroundColor(colorCode)
                    binding.tvSelectedColor.text = colorName
                }
            }
            binding.chipGroupColors.addView(chip)
            if (index == 0) chip.isChecked = true
        }
    }

    private fun setupShapePicker() {
        shapeOptions.forEach { shape ->
            val chip = Chip(requireContext()).apply {
                text = shape
                isCheckable = true
            }
            binding.chipGroupShapes.addView(chip)
        }
        // 默认选中第一个
        (binding.chipGroupShapes.getChildAt(0) as? Chip)?.isChecked = true
    }

    private fun loadExistingMedication() {
        CoroutineScope(Dispatchers.IO).launch {
            val medication = viewModel.getAllMedicationsSync()
                .find { it.id == editingMedicationId }
            withContext(Dispatchers.Main) {
                medication?.let { med ->
                    binding.etMedName.setText(med.name)
                    binding.etDosage.setText(med.dosage)
                    binding.etNotes.setText(med.notes)
                    selectedColorCode = med.colorCode
                    selectedPhotoPath = med.photoPath

                    if (med.photoPath.isNotEmpty()) {
                        Glide.with(requireContext()).load(Uri.parse(med.photoPath))
                            .into(binding.imgMedPhoto)
                        binding.tvPhotoHint.visibility = View.GONE
                    }
                }
            }
        }
    }

    private fun saveMedication() {
        val name = binding.etMedName.text?.toString()?.trim() ?: ""
        val dosage = binding.etDosage.text?.toString()?.trim() ?: ""

        if (name.isEmpty()) {
            binding.tilMedName.error = "请输入药物名称"
            return
        }

        // 获取选中的颜色名称
        var colorName = "白色"
        for (i in 0 until binding.chipGroupColors.childCount) {
            val chip = binding.chipGroupColors.getChildAt(i) as? Chip
            if (chip?.isChecked == true) {
                colorName = chip.text.toString()
                break
            }
        }

        // 获取选中的形状
        var shapeName = "圆形"
        for (i in 0 until binding.chipGroupShapes.childCount) {
            val chip = binding.chipGroupShapes.getChildAt(i) as? Chip
            if (chip?.isChecked == true) {
                shapeName = chip.text.toString()
                break
            }
        }

        val medication = Medication(
            id = if (editingMedicationId != -1L) editingMedicationId else 0,
            name = name,
            color = colorName,
            shape = shapeName,
            colorCode = selectedColorCode,
            dosage = dosage.ifEmpty { "1片" },
            notes = binding.etNotes.text?.toString()?.trim() ?: "",
            photoPath = selectedPhotoPath
        )

        if (editingMedicationId != -1L) {
            viewModel.updateMedication(medication)
            Toast.makeText(requireContext(), "药物信息已更新", Toast.LENGTH_SHORT).show()
        } else {
            viewModel.insertMedication(medication)
            Toast.makeText(requireContext(), "药物「$name」已添加", Toast.LENGTH_SHORT).show()
        }

        findNavController().navigateUp()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
