package com.medtracker.app.ui.history

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.bumptech.glide.Glide
import com.medtracker.app.databinding.FragmentPhotoViewBinding

class PhotoViewFragment : Fragment() {

    private var _binding: FragmentPhotoViewBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentPhotoViewBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val photoPath = arguments?.getString("photo_path") ?: ""
        val date = arguments?.getString("date") ?: ""
        val takenTime = arguments?.getString("taken_time") ?: ""

        binding.tvPhotoDate.text = date
        binding.tvPhotoTime.text = if (takenTime.isNotEmpty()) "鏈嶈嵂鏃堕棿锛?takenTime" else ""

        if (photoPath.isNotEmpty()) {
            Glide.with(this)
                .load(Uri.parse(photoPath))
                .into(binding.imgFullPhoto)
        }

        binding.btnBack.setOnClickListener {
            findNavController().navigateUp()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
