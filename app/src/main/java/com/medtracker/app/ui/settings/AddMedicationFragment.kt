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

    // 棰勮棰滆壊
    private val colorOptions = listOf(
        "鐧借壊" to Color.WHITE,
        "榛勮壊" to Color.parseColor("#FFF176"),
        "绮夌孩鑹? to Color.parseColor("#F48FB1"),
        "姗欒壊" to Color.parseColor("#FFAB40"),
        "钃濊壊" to Color.parseColor("#4FC3F7"),
        "缁胯壊" to Color.parseColor("#81C784"),
        "绾㈣壊" to Color.parseColor("#E57373"),
        "绱壊" to Color.parseColor("#CE93D8"),
        "妫曡壊" to Color.parseColor("#A1887F"),
        "鐏拌壊" to Color.parseColor("#B0BEC5")
    )

    // 棰勮褰㈢姸
    private val shapeOptions = listOf(
        "鍦嗗舰", "妞渾褰?, "鑳跺泭褰?, "闀挎柟褰?, "涓夎褰?, "鑿卞舰", "寮傚舰"
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

        // 鍓傞噺杈撳叆鎻愮ず
        val dosageOptions = arrayOf("1鐗?, "2鐗?, "3鐗?, "鍗婄墖", "1绮?, "2绮?, "1棰?, "2棰?)
        val dosageAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, dosageOptions)
        binding.etDosage.setAdapter(dosageAdapter)

        // 閫夋嫨鐓х墖
        binding.cardMedPhoto.setOnClickListener {
            val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
            pickImageLauncher.launch(intent)
        }

        // 濡傛灉鏄紪杈戞ā寮忥紝鍔犺浇宸叉湁鏁版嵁
        if (editingMedicationId != -1L) {
            binding.tvTitle.text = "缂栬緫鑽墿"
            binding.btnSave.text = "淇濆瓨淇敼"
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
        // 榛樿閫変腑绗竴涓?
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
            binding.tilMedName.error = "璇疯緭鍏ヨ嵂鐗╁悕绉?
            return
        }

        // 鑾峰彇閫変腑鐨勯鑹插悕绉?
        var colorName = "鐧借壊"
        for (i in 0 until binding.chipGroupColors.childCount) {
            val chip = binding.chipGroupColors.getChildAt(i) as? Chip
            if (chip?.isChecked == true) {
                colorName = chip.text.toString()
                break
            }
        }

        // 鑾峰彇閫変腑鐨勫舰鐘?
        var shapeName = "鍦嗗舰"
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
            dosage = dosage.ifEmpty { "1鐗? },
            notes = binding.etNotes.text?.toString()?.trim() ?: "",
            photoPath = selectedPhotoPath
        )

        if (editingMedicationId != -1L) {
            viewModel.updateMedication(medication)
            Toast.makeText(requireContext(), "鑽墿淇℃伅宸叉洿鏂?, Toast.LENGTH_SHORT).show()
        } else {
            viewModel.insertMedication(medication)
            Toast.makeText(requireContext(), "鑽墿銆?name銆嶅凡娣诲姞", Toast.LENGTH_SHORT).show()
        }

        findNavController().navigateUp()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
